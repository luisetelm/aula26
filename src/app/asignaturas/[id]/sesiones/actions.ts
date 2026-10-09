"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import * as content from "@/lib/content";
import { parseLocal } from "@/lib/time";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const optDate = (f: FormData, k: string) => (str(f, k) ? parseLocal(str(f, k)) : null);

// Publicación: "now" (ahora), "draft" (borrador) o "at" (fecha programada en publishAt).
function publishAt(f: FormData) {
  const mode = str(f, "publishMode");
  if (mode === "draft") return null;
  if (mode === "at") return optDate(f, "publishAt") ?? new Date();
  return new Date();
}

function lessonFields(f: FormData) {
  const date = parseLocal(str(f, "date"));
  if (!date) throw new Error("Fecha no válida");
  return { date, title: str(f, "title"), plan: String(f.get("plan") ?? ""), publishAt: publishAt(f) };
}

const refresh = (subjectId: string) => revalidatePath(`/asignaturas/${subjectId}`, "layout");

export async function createLessonAction(subjectId: string, f: FormData) {
  const user = await requireUser();
  const lesson = await content.createLesson(user, subjectId, lessonFields(f));
  refresh(subjectId);
  redirect(`/asignaturas/${subjectId}/sesiones/${lesson.id}`);
}

export async function updateLessonAction(subjectId: string, lessonId: string, f: FormData) {
  const user = await requireUser();
  await content.updateLesson(user, lessonId, lessonFields(f));
  refresh(subjectId);
  redirect(`/asignaturas/${subjectId}#sesion-${lessonId}`);
}

export async function deleteLessonAction(subjectId: string, lessonId: string) {
  const user = await requireUser();
  await content.deleteLesson(user, lessonId);
  refresh(subjectId);
  redirect(`/asignaturas/${subjectId}`);
}

export async function startUploadAction(subjectId: string, meta: { name: string; size: number; mimeType: string }) {
  const user = await requireUser();
  return content.startUpload(user, subjectId, meta);
}

export type MaterialForm =
  | { kind: "TEXT"; title: string; body: string }
  | { kind: "LINK"; title: string; url: string }
  | { kind: "FILE"; title: string; fileId: string };

export async function addMaterialAction(
  subjectId: string,
  lessonId: string,
  input: MaterialForm & { publishAt: string; isSlides: boolean },
): Promise<{ error?: string }> {
  const user = await requireUser();
  try {
    await content.addMaterial(user, lessonId, { ...input, publishAt: input.publishAt ? parseLocal(input.publishAt) : null });
  } catch {
    return { error: "Revisa los datos: el título es obligatorio y los enlaces deben empezar por http." };
  }
  refresh(subjectId);
  return {};
}

export async function deleteMaterialAction(subjectId: string, materialId: string) {
  const user = await requireUser();
  await content.deleteMaterial(user, materialId);
  refresh(subjectId);
}

export type AssessmentForm = {
  title: string;
  instructions: string;
  dueAt: string;
  weight: number;
  rubric: string;
  acceptsSubmissions: boolean;
  acceptsLink: boolean;
  allowedExtensions: string;
  gradingMode: "SCORE" | "COMPLETION";
  fileId: string | null;
  publishAt: string;
};

export async function addAssessmentAction(subjectId: string, lessonId: string, input: AssessmentForm): Promise<{ error?: string }> {
  const user = await requireUser();
  try {
    await content.addAssessment(user, lessonId, {
      ...input,
      dueAt: input.dueAt ? parseLocal(input.dueAt) : null,
      publishAt: input.publishAt ? parseLocal(input.publishAt) : null,
    });
  } catch {
    return { error: "Revisa los datos: el título es obligatorio y el peso va de 0 a 100." };
  }
  refresh(subjectId);
  return {};
}

export async function deleteAssessmentAction(subjectId: string, assessmentId: string) {
  const user = await requireUser();
  await content.deleteAssessment(user, assessmentId);
  refresh(subjectId);
}

export async function setHiddenAction(subjectId: string, kind: "material" | "assessment", id: string, hidden: boolean) {
  const user = await requireUser();
  await content.setItemHidden(user, kind, id, hidden);
  refresh(subjectId);
}

export async function updateMaterialAction(subjectId: string, materialId: string, f: FormData): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  try {
    await content.updateMaterial(user, materialId, {
      title: str(f, "title"),
      body: f.has("body") ? String(f.get("body")) : undefined,
      url: f.has("url") ? str(f, "url") : undefined,
      isSlides: f.has("slidesField") ? f.get("isSlides") === "on" : undefined,
      publishAt: optDate(f, "publishAt"),
    });
  } catch (e) {
    return { error: e instanceof content.Forbidden ? e.message : "Revisa los datos: el título es obligatorio y los enlaces deben empezar por http." };
  }
  refresh(subjectId);
  return { ok: true };
}

export async function updateAssessmentAction(subjectId: string, assessmentId: string, f: FormData): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  try {
    await content.updateAssessment(user, assessmentId, {
      title: str(f, "title"),
      instructions: String(f.get("instructions") ?? ""),
      dueAt: optDate(f, "dueAt"),
      weight: Number(str(f, "weight") || 0),
      rubric: String(f.get("rubric") ?? ""),
      acceptsSubmissions: f.get("acceptsSubmissions") === "on",
      acceptsLink: f.get("acceptsLink") === "on",
      allowedExtensions: str(f, "allowedExtensions"),
      gradingMode: str(f, "gradingMode") === "COMPLETION" ? "COMPLETION" : "SCORE",
      publishAt: optDate(f, "publishAt"),
    });
  } catch (e) {
    return { error: e instanceof content.Forbidden ? e.message : "Revisa los datos: el título es obligatorio y el peso va de 0 a 100." };
  }
  refresh(subjectId);
  return { ok: true };
}
