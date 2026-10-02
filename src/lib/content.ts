import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { User } from "@prisma/client";
import { db } from "./db";
import { canManageSubject } from "./auth";
import { createUploadTarget, removeObject } from "./storage";
import { hashToken } from "./tokens";

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
    where: { OR: [{ material: { lessonId } }, { assessment: { lessonId } }] },
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
  await db.assessment.delete({ where: { id: a.id } });
  if (a.file) await deleteFiles([a.file]);
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
export async function startUpload(actor: User, subjectId: string, input: z.input<typeof uploadInput>) {
  await assertManage(actor, subjectId);
  const meta = uploadInput.parse(input);
  const safeName = meta.name.normalize("NFD").replace(/[^\w.-]+/g, "_").slice(-100);
  const storageKey = `${subjectId}/${randomBytes(12).toString("hex")}/${safeName}`;
  const token = randomBytes(24).toString("base64url");
  const file = await db.storedFile.create({
    data: { subjectId, storageKey, uploadedById: actor.id, ...meta, uploadTokenHash: hashToken(token) },
  });
  const target = await createUploadTarget(storageKey, `/api/archivos/${file.id}/subir?token=${token}`);
  return { fileId: file.id, ...target };
}

// Un archivo solo se puede enlazar una vez y dentro de su asignatura.
async function claimFile(fileId: string, subjectId: string) {
  const f = await db.storedFile.findUnique({ where: { id: fileId }, include: { material: true, assessment: true } });
  if (!f || f.subjectId !== subjectId || f.material || f.assessment) throw new Forbidden("Archivo no válido");
  if (!f.uploadedAt) await db.storedFile.update({ where: { id: f.id }, data: { uploadedAt: new Date() } });
}

async function deleteFiles(files: { id: string; storageKey: string }[]) {
  for (const f of files) {
    await removeObject(f.storageKey).catch((e) => console.error("[storage] No se pudo borrar", f.storageKey, e));
    await db.storedFile.deleteMany({ where: { id: f.id } });
  }
}

// ¿Puede este usuario descargar el archivo? Profesores siempre; alumnos solo si está publicado.
export async function fileForDownload(user: User, fileId: string) {
  const f = await db.storedFile.findUnique({
    where: { id: fileId },
    include: { material: { include: { lesson: true } }, assessment: { include: { lesson: true } } },
  });
  if (!f) return null;
  if (await canManageSubject(user.id, user.isAdmin, f.subjectId)) return f;
  const enrolled = await db.enrollment.findUnique({
    where: { userId_subjectId: { userId: user.id, subjectId: f.subjectId } },
  });
  if (!enrolled) return null;
  const item = f.material ?? f.assessment;
  if (!item || !isPublished(item.lesson.publishAt) || !isPublished(item.publishAt ?? item.lesson.publishAt)) return null;
  return f;
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
  const visible = <T extends { publishAt: Date | null }>(items: T[], lesson: { publishAt: Date | null }) =>
    items.filter((i) => isPublished(i.publishAt ?? lesson.publishAt, now));
  return lessons.map((l) => ({ ...l, materials: visible(l.materials, l), assessments: visible(l.assessments, l) }));
}
