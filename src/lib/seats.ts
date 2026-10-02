import "server-only";
import { randomBytes } from "node:crypto";
import type { Subject, User } from "@prisma/client";
import { db } from "./db";
import { canManageSubject } from "./auth";
import { Forbidden } from "./content";

// Alta del alumnado cuando la escuela solo da nombres (sin correos): el profesor importa los
// nombres como plazas y comparte un enlace; cada estudiante entra con su correo y elige su nombre.

export const cleanName = (s: string) => s.replace(/\s+/g, " ").trim();
const key = (s: string) => cleanName(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

async function assertManage(actor: User, subjectId: string) {
  if (!(await canManageSubject(actor.id, actor.isAdmin, subjectId))) throw new Forbidden("No autorizado");
}

export async function addSeats(actor: User, subjectId: string, names: string[]) {
  await assertManage(actor, subjectId);
  const existing = new Set((await db.seat.findMany({ where: { subjectId }, select: { name: true } })).map((s) => key(s.name)));
  const fresh: string[] = [];
  for (const raw of names) {
    const name = cleanName(raw).slice(0, 200);
    if (!name || existing.has(key(name))) continue;
    existing.add(key(name));
    fresh.push(name);
  }
  if (fresh.length) await db.seat.createMany({ data: fresh.map((name) => ({ subjectId, name })) });
  if (fresh.length) await ensureJoinCode(actor, subjectId);
  return { added: fresh.length, skipped: names.length - fresh.length };
}

export async function ensureJoinCode(actor: User, subjectId: string) {
  await assertManage(actor, subjectId);
  const s = await db.subject.findUniqueOrThrow({ where: { id: subjectId } });
  if (s.joinCode) return s.joinCode;
  return newJoinCode(actor, subjectId);
}

// Cambiar el código invalida el enlace anterior.
export async function newJoinCode(actor: User, subjectId: string) {
  await assertManage(actor, subjectId);
  const joinCode = randomBytes(9).toString("base64url");
  await db.subject.update({ where: { id: subjectId }, data: { joinCode } });
  return joinCode;
}

export async function disableJoin(actor: User, subjectId: string) {
  await assertManage(actor, subjectId);
  await db.subject.update({ where: { id: subjectId }, data: { joinCode: null } });
}

export async function setEmailDomain(actor: User, subjectId: string, domain: string) {
  await assertManage(actor, subjectId);
  const emailDomain = domain.trim().toLowerCase().replace(/^@/, "");
  if (emailDomain && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(emailDomain)) throw new Forbidden("Dominio no válido");
  await db.subject.update({ where: { id: subjectId }, data: { emailDomain } });
}

export async function subjectByJoinCode(code: string) {
  if (!code || code.length > 40) return null;
  return db.subject.findUnique({ where: { joinCode: code } });
}

export const emailAllowed = (subject: Pick<Subject, "emailDomain">, email: string) =>
  !subject.emailDomain || email.toLowerCase().endsWith(`@${subject.emailDomain}`);

export async function freeSeats(subjectId: string) {
  return db.seat.findMany({ where: { subjectId, userId: null }, orderBy: { name: "asc" } });
}

// El estudiante reclama su plaza: queda matriculado y su nombre pasa a su cuenta si no tenía.
export async function claimSeat(user: User, code: string, seatId: string) {
  const subject = await subjectByJoinCode(code);
  if (!subject) throw new Forbidden("El enlace de inscripción no es válido");
  if (!emailAllowed(subject, user.email)) throw new Forbidden(`Entra con tu correo de @${subject.emailDomain}`);
  const enrolled = await db.enrollment.findUnique({ where: { userId_subjectId: { userId: user.id, subjectId: subject.id } } });
  if (enrolled) return subject;
  const now = new Date();
  return db.$transaction(async (tx) => {
    const { count } = await tx.seat.updateMany({
      where: { id: seatId, subjectId: subject.id, userId: null },
      data: { userId: user.id, claimedAt: now },
    });
    if (count !== 1) throw new Forbidden("Ese nombre ya lo ha elegido otra persona. Habla con tu profesor o profesora");
    const seat = await tx.seat.findUniqueOrThrow({ where: { id: seatId } });
    await tx.enrollment.create({ data: { userId: user.id, subjectId: subject.id, role: "STUDENT" } });
    if (!user.firstName && !user.lastName) {
      await tx.user.update({ where: { id: user.id }, data: { firstName: seat.name } });
    }
    return subject;
  });
}

// Deshace una elección equivocada: la plaza vuelve a estar libre y la persona sale de la asignatura.
export async function releaseSeat(actor: User, subjectId: string, seatId: string) {
  await assertManage(actor, subjectId);
  const seat = await db.seat.findFirst({ where: { id: seatId, subjectId } });
  if (!seat?.userId) return;
  await db.$transaction([
    db.seat.update({ where: { id: seat.id }, data: { userId: null, claimedAt: null } }),
    db.enrollment.deleteMany({ where: { userId: seat.userId, subjectId, role: "STUDENT" } }),
  ]);
}

export async function removeSeat(actor: User, subjectId: string, seatId: string) {
  await assertManage(actor, subjectId);
  await db.seat.deleteMany({ where: { id: seatId, subjectId, userId: null } });
}
