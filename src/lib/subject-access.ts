import "server-only";
import { notFound } from "next/navigation";
import { db } from "./db";
import { requireUser } from "./auth";

// Devuelve la asignatura si el usuario puede verla; si no, 404.
export async function getSubjectAccess(subjectId: string) {
  const user = await requireUser();
  const subject = await db.subject.findUnique({ where: { id: subjectId } });
  if (!subject) notFound();
  const enrollment = await db.enrollment.findUnique({
    where: { userId_subjectId: { userId: user.id, subjectId } },
  });
  if (!user.isAdmin && !enrollment) notFound();
  const canManage = user.isAdmin || enrollment?.role === "TEACHER";
  return { user, subject, canManage };
}
