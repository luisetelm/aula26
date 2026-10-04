import "server-only";
import { z } from "zod";
import type { User } from "@prisma/client";
import { db } from "./db";
import { canManageSubject } from "./auth";
import { Forbidden } from "./content";

// Personas de una asignatura: matrícula por correo, cambio de rol y baja. Lo usan la página
// Personas y el conector de Claude.

export const personEntry = z.object({
  email: z.email().max(254),
  firstName: z.string().max(100),
  lastName: z.string().max(150),
  role: z.enum(["TEACHER", "STUDENT"]),
});

export type EnrollResult = { created: number; enrolled: number; alreadyEnrolled: number };

async function assertManage(actor: User, subjectId: string) {
  if (!(await canManageSubject(actor.id, actor.isAdmin, subjectId))) throw new Forbidden("No autorizado");
}

export async function enrollPeople(actor: User, subjectId: string, rawEntries: unknown): Promise<EnrollResult> {
  await assertManage(actor, subjectId);
  const entries = z.array(personEntry).max(2000).parse(rawEntries);
  const result: EnrollResult = { created: 0, enrolled: 0, alreadyEnrolled: 0 };

  for (const e of entries) {
    const email = e.email.toLowerCase();
    const existing = await db.user.findUnique({ where: { email } });
    const user =
      existing ??
      (await db.user.create({ data: { email, firstName: e.firstName, lastName: e.lastName } }));
    if (!existing) result.created++;
    else if (!existing.firstName && !existing.lastName && (e.firstName || e.lastName)) {
      await db.user.update({ where: { id: user.id }, data: { firstName: e.firstName, lastName: e.lastName } });
    }

    const enrollment = await db.enrollment.findUnique({
      where: { userId_subjectId: { userId: user.id, subjectId } },
    });
    if (enrollment) result.alreadyEnrolled++;
    else {
      await db.enrollment.create({ data: { userId: user.id, subjectId, role: e.role } });
      result.enrolled++;
    }
  }
  return result;
}

// Un profesor no se quita a sí mismo el rol ni se da de baja (salvo administración).
async function otherEnrollment(actor: User, subjectId: string, enrollmentId: string) {
  await assertManage(actor, subjectId);
  const e = await db.enrollment.findFirst({ where: { id: enrollmentId, subjectId } });
  if (!e) throw new Forbidden("Esa persona no está en la asignatura");
  if (e.userId === actor.id && !actor.isAdmin) throw new Forbidden("No puedes cambiarte a ti mismo");
  return e;
}

export async function setRole(actor: User, subjectId: string, enrollmentId: string, role: "TEACHER" | "STUDENT") {
  const e = await otherEnrollment(actor, subjectId, enrollmentId);
  await db.enrollment.update({ where: { id: e.id }, data: { role: z.enum(["TEACHER", "STUDENT"]).parse(role) } });
}

// La baja no borra sus entregas; si tenía plaza del listado, la plaza vuelve a quedar libre.
export async function unenroll(actor: User, subjectId: string, enrollmentId: string) {
  const e = await otherEnrollment(actor, subjectId, enrollmentId);
  await db.$transaction([
    db.seat.updateMany({ where: { subjectId, userId: e.userId }, data: { userId: null, claimedAt: null } }),
    db.enrollment.delete({ where: { id: e.id } }),
  ]);
}
