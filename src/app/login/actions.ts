"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { sendLoginEmail } from "@/lib/mail";
import { hashToken, newToken, normalizeEmail } from "@/lib/tokens";
import { isBootstrapAdmin } from "@/lib/auth";

const TOKEN_MINUTES = 15;
const MAX_PER_HOUR = 5;

export type LoginState = { status: "idle" | "sent" | "error"; message?: string };

export async function requestLogin(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = z.email().safeParse(normalizeEmail(String(formData.get("email") ?? "")));
  if (!parsed.success) return { status: "error", message: "Escribe un correo válido." };
  const email = parsed.data;

  let user = await db.user.findUnique({ where: { email } });
  if (!user && isBootstrapAdmin(email)) {
    user = await db.user.create({ data: { email, isAdmin: true } });
  }

  // Respondemos igual exista o no el correo, para no revelar quién está dado de alta.
  const sent: LoginState = {
    status: "sent",
    message: "Si tu correo está dado de alta, te hemos enviado un enlace para entrar. Revisa tu bandeja de entrada.",
  };
  if (!user) return sent;

  const recent = await db.loginToken.count({
    where: { email, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= MAX_PER_HOUR) {
    return { status: "error", message: "Has pedido demasiados enlaces. Espera un rato y vuelve a intentarlo." };
  }

  const token = newToken();
  await db.loginToken.create({
    data: {
      email,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_MINUTES * 60 * 1000),
    },
  });
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  try {
    await sendLoginEmail(email, `${appUrl}/auth/verify?token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error("[mail] Error enviando el enlace", err);
    return { status: "error", message: "No se ha podido enviar el correo. Inténtalo de nuevo en unos minutos." };
  }
  return sent;
}
