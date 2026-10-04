"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { destroySession, requireAdmin } from "@/lib/auth";
import { createSubject as createSubjectFor, deleteSubject as removeSubject, updateSubject as updateSubjectFor } from "@/lib/content";

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function createSubject(formData: FormData) {
  const user = await requireAdmin();
  const subject = await createSubjectFor(user, {
    name: String(formData.get("name") ?? ""),
    academicYear: String(formData.get("academicYear") ?? ""),
    group: String(formData.get("group") ?? ""),
  });
  revalidatePath("/");
  redirect(`/asignaturas/${subject.id}/personas`);
}

export async function updateSubject(subjectId: string, formData: FormData) {
  const user = await requireAdmin();
  await updateSubjectFor(user, subjectId, {
    name: String(formData.get("name") ?? ""),
    academicYear: String(formData.get("academicYear") ?? ""),
    group: String(formData.get("group") ?? ""),
  });
  revalidatePath("/", "layout");
  redirect(`/asignaturas/${subjectId}/ajustes?guardado=1`);
}

export type DeleteState = { error?: string };

// Para borrar hay que escribir el nombre exacto de la asignatura.
export async function deleteSubject(subjectId: string, _prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const user = await requireAdmin();
  const subject = await db.subject.findUnique({ where: { id: subjectId } });
  if (!subject) redirect("/");
  if (String(formData.get("confirm") ?? "").trim() !== subject.name.trim()) {
    return { error: "El nombre no coincide. Escríbelo exactamente igual." };
  }
  await removeSubject(user, subjectId);
  revalidatePath("/");
  redirect("/");
}
