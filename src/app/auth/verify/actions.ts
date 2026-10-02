"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { hashToken } from "@/lib/tokens";
import { safeNext } from "@/lib/next-path";

export async function consumeLogin(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const tokenHash = hashToken(token);
  const now = new Date();

  // Marcado atómico: solo una petición puede usar el enlace.
  const { count } = await db.loginToken.updateMany({
    where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (count !== 1) redirect("/auth/verify?error=1");

  const login = await db.loginToken.findUnique({ where: { tokenHash } });
  const user = login && (await db.user.findUnique({ where: { email: login.email } }));
  if (!user) redirect("/auth/verify?error=1");

  await createSession(user.id);
  redirect(safeNext(formData.get("next")));
}
