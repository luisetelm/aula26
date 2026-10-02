"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { Forbidden } from "@/lib/content";
import * as subs from "@/lib/submissions";

const refresh = (subjectId: string) => revalidatePath(`/asignaturas/${subjectId}`, "layout");

export async function startSubmissionUploadAction(assessmentId: string, meta: { name: string; size: number; mimeType: string }) {
  const user = await requireUser();
  return subs.startSubmissionUpload(user, assessmentId, meta);
}

export async function submitAction(
  subjectId: string,
  assessmentId: string,
  input: { fileIds: string[]; note: string },
): Promise<{ error?: string }> {
  const user = await requireUser();
  try {
    await subs.submit(user, assessmentId, input);
  } catch (e) {
    return { error: e instanceof Forbidden ? `${e.message}.` : "No se ha podido entregar. Inténtalo de nuevo." };
  }
  refresh(subjectId);
  return {};
}

export async function removeSubmissionFileAction(subjectId: string, fileId: string) {
  const user = await requireUser();
  await subs.removeSubmissionFile(user, fileId);
  refresh(subjectId);
}

export async function gradeAction(
  subjectId: string,
  assessmentId: string,
  studentId: string,
  _prev: { ok?: boolean; error?: string },
  f: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireUser();
  const raw = String(f.get("grade") ?? "").trim().replace(",", ".");
  const grade = raw === "" ? null : Number(raw);
  if (grade !== null && (!Number.isFinite(grade) || grade < 0 || grade > 10)) return { error: "La nota va de 0 a 10." };
  await subs.gradeSubmission(user, assessmentId, studentId, { grade, feedback: String(f.get("feedback") ?? "") });
  refresh(subjectId);
  return { ok: true };
}

export async function discardProposalAction(subjectId: string, assessmentId: string, studentId: string) {
  const user = await requireUser();
  await subs.discardProposal(user, assessmentId, studentId);
  refresh(subjectId);
}

export async function publishGradesAction(subjectId: string, assessmentId: string, published: boolean) {
  const user = await requireUser();
  await subs.setGradesPublished(user, assessmentId, published);
  refresh(subjectId);
}
