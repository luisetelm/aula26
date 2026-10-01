"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { destroySession, requireAdmin } from "@/lib/auth";

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
