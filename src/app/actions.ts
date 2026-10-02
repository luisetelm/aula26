"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { destroySession, requireAdmin } from "@/lib/auth";
import { deleteSubject as removeSubject } from "@/lib/content";

export async function logout() {
  await destroySession();
  redirect("/login");
}

const subjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  academicYear: z.string().trim().min(1).max(20),
  group: z.string().trim().max(40),
});

export async function createSubject(formData: FormData) {
  await requireAdmin();
  const data = subjectSchema.parse({
    name: formData.get("name"),
    academicYear: formData.get("academicYear"),
    group: formData.get("group") ?? "",
  });
  const subject = await db.subject.create({ data });
  revalidatePath("/");
  redirect(`/asignaturas/${subject.id}/personas`);
}

export async function updateSubject(subjectId: string, formData: FormData) {
  await requireAdmin();
  const data = subjectSchema.parse({
    name: formData.get("name"),
    academicYear: formData.get("academicYear"),
    group: formData.get("group") ?? "",
  });
  await db.subject.update({ where: { id: subjectId }, data });
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
