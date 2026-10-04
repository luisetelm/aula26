"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canManageSubject, requireUser } from "@/lib/auth";
import { parseRosterFile } from "@/lib/roster-file";
import type { Sheet } from "@/lib/roster";
import * as seats from "@/lib/seats";
import * as people from "@/lib/people";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

async function requireManager(subjectId: string) {
  const user = await requireUser();
  if (!(await canManageSubject(user.id, user.isAdmin, subjectId))) throw new Error("No autorizado");
  return user;
}

export type PreviewResult = { ok: true; sheet: Sheet } | { ok: false; error: string };

export async function previewRoster(subjectId: string, formData: FormData): Promise<PreviewResult> {
  await requireManager(subjectId);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Elige un archivo." };
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: "El archivo pesa más de 5 MB." };
  if (!/\.(xlsx|csv)$/i.test(file.name)) {
    return { ok: false, error: "Usa un archivo .xlsx o .csv. Si es un .xls antiguo, guárdalo como .xlsx desde Excel." };
  }
  try {
    const sheet = await parseRosterFile(file.name, await file.arrayBuffer());
    if (sheet.rows.length === 0) return { ok: false, error: "No he encontrado ninguna fila con datos en el archivo." };
    return { ok: true, sheet };
  } catch {
    return { ok: false, error: "No he podido leer el archivo. Comprueba que es un Excel válido." };
  }
}

export type ImportResult = people.EnrollResult;

export async function importRoster(subjectId: string, rawEntries: unknown): Promise<ImportResult> {
  const user = await requireManager(subjectId);
  const result = await people.enrollPeople(user, subjectId, rawEntries);
  revalidatePath(`/asignaturas/${subjectId}/personas`);
  return result;
}

export async function addPerson(subjectId: string, formData: FormData) {
  const entry = people.personEntry.parse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
    role: formData.get("role"),
  });
  await importRoster(subjectId, [entry]);
}

export async function setRole(subjectId: string, enrollmentId: string, role: "TEACHER" | "STUDENT") {
  const user = await requireManager(subjectId);
  await people.setRole(user, subjectId, enrollmentId, role).catch(() => {});
  revalidatePath(`/asignaturas/${subjectId}/personas`);
}

export async function removePerson(subjectId: string, enrollmentId: string) {
  const user = await requireManager(subjectId);
  await people.unenroll(user, subjectId, enrollmentId).catch(() => {});
  revalidatePath(`/asignaturas/${subjectId}/personas`);
}

// ---------- Plazas (listados sin correo) e inscripción con enlace ----------

export async function importSeats(subjectId: string, names: string[]) {
  const user = await requireManager(subjectId);
  const result = await seats.addSeats(user, subjectId, z.array(z.string().max(300)).max(2000).parse(names));
  revalidatePath(`/asignaturas/${subjectId}/personas`);
  return result;
}

export async function newJoinLink(subjectId: string) {
  const user = await requireManager(subjectId);
  await seats.newJoinCode(user, subjectId);
  revalidatePath(`/asignaturas/${subjectId}/personas`);
}

export async function disableJoinLink(subjectId: string) {
  const user = await requireManager(subjectId);
  await seats.disableJoin(user, subjectId);
  revalidatePath(`/asignaturas/${subjectId}/personas`);
}

export async function saveEmailDomain(subjectId: string, formData: FormData) {
  const user = await requireManager(subjectId);
  await seats.setEmailDomain(user, subjectId, String(formData.get("domain") ?? "")).catch(() => {});
  revalidatePath(`/asignaturas/${subjectId}/personas`);
}

export async function releaseSeat(subjectId: string, seatId: string) {
  const user = await requireManager(subjectId);
  await seats.releaseSeat(user, subjectId, seatId);
  revalidatePath(`/asignaturas/${subjectId}/personas`);
}

export async function removeSeat(subjectId: string, seatId: string) {
  const user = await requireManager(subjectId);
  await seats.removeSeat(user, subjectId, seatId);
  revalidatePath(`/asignaturas/${subjectId}/personas`);
}
