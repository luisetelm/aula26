import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { User } from "@prisma/client";
import { db } from "./db";
import { canManageSubject } from "./auth";
import { createUploadTarget } from "./storage";
import { hashToken } from "./tokens";
import { Forbidden, deleteFiles, isPublished, uploadInput } from "./content";

// Entregas del alumnado y notas. Igual que content.ts: cada función comprueba permisos.

export const MAX_FILES_PER_SUBMISSION = 10;

async function assessmentWithSubject(assessmentId: string) {
  const a = await db.assessment.findUnique({ where: { id: assessmentId }, include: { lesson: true } });
  if (!a) throw new Forbidden("La prueba no existe");
  return a;
}

// El alumno puede entregar si está matriculado como alumno y la prueba está publicada y admite entregas.
async function assertCanSubmit(actor: User, assessmentId: string) {
  const a = await assessmentWithSubject(assessmentId);
  const enrollment = await db.enrollment.findUnique({
    where: { userId_subjectId: { userId: actor.id, subjectId: a.lesson.subjectId } },
  });
  const visible = isPublished(a.lesson.publishAt) && isPublished(a.publishAt ?? a.lesson.publishAt);
  if (enrollment?.role !== "STUDENT" || !visible || !a.acceptsSubmissions) throw new Forbidden("No puedes entregar aquí");
  return a;
}

async function assertManageAssessment(actor: User, assessmentId: string) {
  const a = await assessmentWithSubject(assessmentId);
  if (!(await canManageSubject(actor.id, actor.isAdmin, a.lesson.subjectId))) throw new Forbidden("No autorizado");
  return a;
}

export async function startSubmissionUpload(actor: User, assessmentId: string, input: z.input<typeof uploadInput>) {
  const a = await assertCanSubmit(actor, assessmentId);
  const meta = uploadInput.parse(input);
  const safeName = meta.name.normalize("NFD").replace(/[^\w.-]+/g, "_").slice(-100);
  const storageKey = `${a.lesson.subjectId}/entregas/${a.id}/${randomBytes(12).toString("hex")}/${safeName}`;
  const token = randomBytes(24).toString("base64url");
  const file = await db.storedFile.create({
    data: { subjectId: a.lesson.subjectId, storageKey, uploadedById: actor.id, ...meta, uploadTokenHash: hashToken(token) },
  });
  const target = await createUploadTarget(storageKey, `/api/archivos/${file.id}/subir?token=${token}`);
  return { fileId: file.id, ...target };
}

export const submitInput = z.object({
  fileIds: z.array(z.string().min(1)).max(MAX_FILES_PER_SUBMISSION).default([]),
  note: z.string().max(5000).default(""),
});

// Entregar (o volver a entregar añadiendo archivos). La fecha de entrega es la del último envío.
export async function submit(actor: User, assessmentId: string, input: z.input<typeof submitInput>) {
  const a = await assertCanSubmit(actor, assessmentId);
  const data = submitInput.parse(input);
  const existing = await db.submission.findUnique({
    where: { assessmentId_studentId: { assessmentId, studentId: actor.id } },
    include: { files: true },
  });
  if (existing?.gradedAt) throw new Forbidden("La entrega ya está corregida");
  if ((existing?.files.length ?? 0) + data.fileIds.length > MAX_FILES_PER_SUBMISSION) throw new Forbidden("Demasiados archivos");
  if (data.fileIds.length === 0 && !existing?.files.length && !data.note.trim()) throw new Forbidden("La entrega está vacía");

  const files = await db.storedFile.findMany({ where: { id: { in: data.fileIds } }, include: { material: true, assessment: true } });
  const ok = files.length === data.fileIds.length && files.every(
    (f) => f.uploadedById === actor.id && f.subjectId === a.lesson.subjectId && !f.submissionId && !f.material && !f.assessment,
  );
  if (!ok) throw new Forbidden("Archivo no válido");

  const now = new Date();
  const submission = await db.submission.upsert({
    where: { assessmentId_studentId: { assessmentId, studentId: actor.id } },
    create: { assessmentId, studentId: actor.id, note: data.note, submittedAt: now },
    update: { note: data.note, submittedAt: now },
  });
  if (files.length) {
    await db.storedFile.updateMany({
      where: { id: { in: data.fileIds } },
      data: { submissionId: submission.id, uploadedAt: now },
    });
  }
  return submission;
}

// El alumno quita un archivo de su entrega mientras no esté corregida.
export async function removeSubmissionFile(actor: User, fileId: string) {
  const f = await db.storedFile.findUnique({ where: { id: fileId }, include: { submission: true } });
  if (!f?.submission || f.submission.studentId !== actor.id || f.submission.gradedAt) throw new Forbidden("No autorizado");
  await deleteFiles([f]);
  return f.submission.assessmentId;
}

export const gradeInput = z.object({
  grade: z.number().min(0).max(10).nullable(),
  feedback: z.string().max(10000).default(""),
});

// Nota de 0 a 10 y comentario. Se puede poner nota aunque no haya entrega (por ejemplo, un 0).
export async function gradeSubmission(actor: User, assessmentId: string, studentId: string, input: z.input<typeof gradeInput>) {
  const a = await assertManageAssessment(actor, assessmentId);
  const enrolled = await db.enrollment.findUnique({
    where: { userId_subjectId: { userId: studentId, subjectId: a.lesson.subjectId } },
  });
  if (enrolled?.role !== "STUDENT") throw new Forbidden("No es alumno de la asignatura");
  const data = gradeInput.parse(input);
  const gradedAt = data.grade === null && !data.feedback.trim() ? null : new Date();
  return db.submission.upsert({
    where: { assessmentId_studentId: { assessmentId, studentId } },
    create: { assessmentId, studentId, ...data, gradedAt },
    update: { ...data, gradedAt },
  });
}

export async function setGradesPublished(actor: User, assessmentId: string, published: boolean) {
  await assertManageAssessment(actor, assessmentId);
  return db.assessment.update({ where: { id: assessmentId }, data: { gradesPublished: published } });
}

export type SubmissionStatus = "pendiente" | "entregada" | "tarde" | "sin-entregar";

export function submissionStatus(dueAt: Date | null, submittedAt: Date | null | undefined, now = new Date()): SubmissionStatus {
  if (submittedAt) return dueAt && submittedAt > dueAt ? "tarde" : "entregada";
  return dueAt && dueAt < now ? "sin-entregar" : "pendiente";
}

// Vista del profesor: todo el alumnado de la asignatura con su entrega (o sin ella).
export async function getSubmissionsOverview(actor: User, assessmentId: string) {
  const a = await assertManageAssessment(actor, assessmentId);
  const [students, submissions] = await Promise.all([
    db.enrollment.findMany({
      where: { subjectId: a.lesson.subjectId, role: "STUDENT" },
      include: { user: true },
      orderBy: [{ user: { lastName: "asc" } }, { user: { firstName: "asc" } }, { user: { email: "asc" } }],
    }),
    db.submission.findMany({ where: { assessmentId }, include: { files: { orderBy: { createdAt: "asc" } } } }),
  ]);
  const byStudent = new Map(submissions.map((s) => [s.studentId, s]));
  const now = new Date();
  return {
    assessment: a,
    rows: students.map(({ user }) => {
      const s = byStudent.get(user.id) ?? null;
      return { student: user, submission: s, status: submissionStatus(a.dueAt, s?.submittedAt, now) };
    }),
  };
}

// Las entregas del alumno en estas pruebas (para el timeline). La nota solo si está publicada.
export async function getMySubmissions(studentId: string, assessmentIds: string[]) {
  const subs = await db.submission.findMany({
    where: { studentId, assessmentId: { in: assessmentIds } },
    include: { files: { orderBy: { createdAt: "asc" } }, assessment: { select: { gradesPublished: true } } },
  });
  return new Map(
    subs.map((s) => [
      s.assessmentId,
      {
        ...s,
        grade: s.assessment.gradesPublished ? s.grade : null,
        feedback: s.assessment.gradesPublished ? s.feedback : "",
        graded: !!s.gradedAt,
      },
    ]),
  );
}

// Para el profesor en el timeline: cuántas entregas hay por prueba.
export async function countSubmissions(assessmentIds: string[]) {
  const rows = await db.submission.groupBy({
    by: ["assessmentId"],
    where: { assessmentId: { in: assessmentIds }, submittedAt: { not: null } },
    _count: true,
  });
  return new Map(rows.map((r) => [r.assessmentId, r._count]));
}
