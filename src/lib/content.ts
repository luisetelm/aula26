import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { User } from "@prisma/client";
import { db } from "./db";
import { canManageSubject } from "./auth";
import { createUploadTarget, putObject, removeObject } from "./storage";
import { hashToken } from "./tokens";
import { normalizeExtensions } from "./extensions";
import { daysUntil } from "./time";

// Lógica de contenido compartida por la web y (más adelante) el servidor MCP.
// Cada función comprueba permisos con el usuario que actúa.

export class Forbidden extends Error {}

async function assertManage(actor: User, subjectId: string) {
  if (!(await canManageSubject(actor.id, actor.isAdmin, subjectId))) throw new Forbidden("No autorizado");
}

async function lessonSubject(lessonId: string) {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { subjectId: true } });
  if (!lesson) throw new Forbidden("La sesión no existe");
  return lesson.subjectId;
}

export const isPublished = (publishAt: Date | null | undefined, now = new Date()) =>
  !!publishAt && publishAt <= now;

// Hasta el día de la sesión el alumnado solo ve su título y fecha: el programa, el material y las
// tareas aparecen ese día. Un material o tarea con fecha de publicación propia se ve desde esa
// fecha (por ejemplo, una lectura previa).
export const sessionStarted = (lesson: { date: Date }, now = new Date()) => daysUntil(lesson.date, now) <= 0;
export const itemVisible = (
  item: { publishAt: Date | null },
  lesson: { publishAt: Date | null; date: Date },
  now = new Date(),
) => isPublished(lesson.publishAt, now) && (item.publishAt ? item.publishAt <= now : sessionStarted(lesson, now));

// ---------- Sesiones ----------

export const lessonInput = z.object({
  date: z.date(),
  title: z.string().trim().min(1).max(200),
  plan: z.string().max(20000).default(""),
  publishAt: z.date().nullable(),
});

export async function createLesson(actor: User, subjectId: string, input: z.input<typeof lessonInput>) {
  await assertManage(actor, subjectId);
  return db.lesson.create({ data: { subjectId, ...lessonInput.parse(input) } });
}

export async function updateLesson(actor: User, lessonId: string, input: z.input<typeof lessonInput>) {
  await assertManage(actor, await lessonSubject(lessonId));
  return db.lesson.update({ where: { id: lessonId }, data: lessonInput.parse(input) });
}

export async function deleteLesson(actor: User, lessonId: string) {
  const subjectId = await lessonSubject(lessonId);
  await assertManage(actor, subjectId);
  const files = await db.storedFile.findMany({
    where: { OR: [{ material: { lessonId } }, { assessment: { lessonId } }, { submission: { assessment: { lessonId } } }] },
  });
  await db.lesson.delete({ where: { id: lessonId } });
  await deleteFiles(files);
  return subjectId;
}

// ---------- Material ----------

export const materialInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("TEXT"), title: z.string().trim().min(1).max(200), body: z.string().min(1).max(20000) }),
  z.object({ kind: z.literal("LINK"), title: z.string().trim().min(1).max(200), url: z.url({ protocol: /^https?$/ }) }),
  z.object({ kind: z.literal("FILE"), title: z.string().trim().min(1).max(200), fileId: z.string().min(1) }),
]).and(z.object({ publishAt: z.date().nullable().default(null), isSlides: z.boolean().default(false) }));

export async function addMaterial(actor: User, lessonId: string, input: z.input<typeof materialInput>) {
  const subjectId = await lessonSubject(lessonId);
  await assertManage(actor, subjectId);
  const data = materialInput.parse(input);
  if (data.kind === "FILE") await claimFile(data.fileId, subjectId);
  const position = await db.material.count({ where: { lessonId } });
  return db.material.create({ data: { lessonId, position, ...data } });
}

export async function deleteMaterial(actor: User, materialId: string) {
  const m = await db.material.findUnique({ where: { id: materialId }, include: { lesson: true, file: true } });
  if (!m) return null;
  await assertManage(actor, m.lesson.subjectId);
  await db.material.delete({ where: { id: m.id } });
  if (m.file) await deleteFiles([m.file]);
  return m.lesson.subjectId;
}

// ---------- Pruebas ----------

export const assessmentInput = z.object({
  title: z.string().trim().min(1).max(200),
  instructions: z.string().max(20000).default(""),
  dueAt: z.date().nullable().default(null),
  weight: z.number().min(0).max(100).default(0),
  rubric: z.string().max(20000).default(""),
  acceptsSubmissions: z.boolean().default(false),
  acceptsLink: z.boolean().default(false),
  allowedExtensions: z.string().max(200).default("").transform(normalizeExtensions),
  gradingMode: z.enum(["SCORE", "COMPLETION"]).default("SCORE"),
  fileId: z.string().nullable().default(null),
  publishAt: z.date().nullable().default(null),
});

export async function addAssessment(actor: User, lessonId: string, input: z.input<typeof assessmentInput>) {
  const subjectId = await lessonSubject(lessonId);
  await assertManage(actor, subjectId);
  const data = assessmentInput.parse(input);
  if (data.fileId) await claimFile(data.fileId, subjectId);
  return db.assessment.create({ data: { lessonId, ...data } });
}

export async function deleteAssessment(actor: User, assessmentId: string) {
  const a = await db.assessment.findUnique({ where: { id: assessmentId }, include: { lesson: true, file: true } });
  if (!a) return null;
  await assertManage(actor, a.lesson.subjectId);
  const submitted = await db.storedFile.findMany({ where: { submission: { assessmentId } } });
  await db.assessment.delete({ where: { id: a.id } });
  await deleteFiles([...(a.file ? [a.file] : []), ...submitted]);
  return a.lesson.subjectId;
}

// ---------- Archivos ----------

export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export const uploadInput = z.object({
  name: z.string().trim().min(1).max(200),
  size: z.number().int().positive().max(MAX_FILE_BYTES),
  mimeType: z.string().max(200).default("application/octet-stream"),
});

// Reserva un archivo y devuelve adónde subirlo. El navegador lo sube directamente al almacenamiento.
const storageKeyFor = (subjectId: string, name: string) =>
  `${subjectId}/${randomBytes(12).toString("hex")}/${name.normalize("NFD").replace(/[^\w.-]+/g, "_").slice(-100)}`;

export async function startUpload(actor: User, subjectId: string, input: z.input<typeof uploadInput>) {
  await assertManage(actor, subjectId);
  const meta = uploadInput.parse(input);
  const storageKey = storageKeyFor(subjectId, meta.name);
  const token = randomBytes(24).toString("base64url");
  const file = await db.storedFile.create({
    data: { subjectId, storageKey, uploadedById: actor.id, ...meta, uploadTokenHash: hashToken(token) },
  });
  const target = await createUploadTarget(storageKey, `/api/archivos/${file.id}/subir?token=${token}`);
  return { fileId: file.id, ...target };
}

// Guarda un archivo que llega entero al servidor (por ejemplo, desde el conector de Claude).
export async function storeFile(actor: User, subjectId: string, input: { name: string; mimeType: string; data: Buffer }) {
  await assertManage(actor, subjectId);
  const meta = uploadInput.parse({ name: input.name, size: input.data.length, mimeType: input.mimeType });
  const storageKey = storageKeyFor(subjectId, meta.name);
  await putObject(storageKey, input.data, meta.mimeType);
  return db.storedFile.create({ data: { subjectId, storageKey, uploadedById: actor.id, ...meta, uploadedAt: new Date() } });
}

// Un archivo solo se puede enlazar una vez y dentro de su asignatura.
async function claimFile(fileId: string, subjectId: string) {
  const f = await db.storedFile.findUnique({ where: { id: fileId }, include: { material: true, assessment: true } });
  if (!f || f.subjectId !== subjectId || f.material || f.assessment || f.submissionId) throw new Forbidden("Archivo no válido");
  if (!f.uploadedAt) await db.storedFile.update({ where: { id: f.id }, data: { uploadedAt: new Date() } });
}

export async function deleteFiles(files: { id: string; storageKey: string }[]) {
  for (const f of files) {
    await removeObject(f.storageKey).catch((e) => console.error("[storage] No se pudo borrar", f.storageKey, e));
    await db.storedFile.deleteMany({ where: { id: f.id } });
  }
}

// ¿Puede este usuario descargar el archivo? Profesores siempre; alumnos solo si está publicado.
export async function fileForDownload(user: User, fileId: string) {
  const f = await db.storedFile.findUnique({
    where: { id: fileId },
    include: { material: { include: { lesson: true } }, assessment: { include: { lesson: true } }, submission: true },
  });
  if (!f) return null;
  if (await canManageSubject(user.id, user.isAdmin, f.subjectId)) return f;
  // Una entrega solo la ve quien la hizo (y el profesorado, arriba).
  if (f.submission) return f.submission.studentId === user.id ? f : null;
  const enrolled = await db.enrollment.findUnique({
    where: { userId_subjectId: { userId: user.id, subjectId: f.subjectId } },
  });
  if (!enrolled) return null;
  const item = f.material ?? f.assessment;
  if (!item || !itemVisible(item, item.lesson)) return null;
  return f;
}

// ---------- Asignaturas ----------

// Borra la asignatura con todo su contenido, entregas y archivos. Solo administración.
export async function deleteSubject(actor: User, subjectId: string) {
  if (!actor.isAdmin) throw new Forbidden("No autorizado");
  const files = await db.storedFile.findMany({ where: { subjectId } });
  await db.subject.delete({ where: { id: subjectId } });
  await deleteFiles(files);
}

// ---------- Timeline ----------

export async function getTimeline(subjectId: string, canManage: boolean) {
  const now = new Date();
  const lessons = await db.lesson.findMany({
    where: { subjectId, ...(canManage ? {} : { publishAt: { lte: now } }) },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    include: {
      materials: { orderBy: { position: "asc" }, include: { file: true } },
      assessments: { orderBy: { createdAt: "asc" }, include: { file: true } },
    },
  });
  if (canManage) return lessons;
  return lessons.map((l) => ({
    ...l,
    plan: sessionStarted(l, now) ? l.plan : "",
    materials: l.materials.filter((m) => itemVisible(m, l, now)),
    assessments: l.assessments.filter((a) => itemVisible(a, l, now)),
  }));
}
