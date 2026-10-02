"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { sendLoginEmail } from "@/lib/mail";
import { timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { hashToken, newCode, newToken, normalizeEmail } from "@/lib/tokens";
import { createSession, isBootstrapAdmin } from "@/lib/auth";

const TOKEN_MINUTES = 15;
const MAX_PER_HOUR = 5;
const MAX_CODE_ATTEMPTS = 5;

export type LoginState = { status: "idle" | "sent" | "error"; message?: string; email?: string };

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
    message: "Si tu correo está dado de alta, te hemos enviado un enlace y un código. Abre el enlace o escribe aquí el código.",
    email,
  };
  if (!user) return sent;

  const recent = await db.loginToken.count({
    where: { email, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= MAX_PER_HOUR) {
    return { status: "error", message: "Has pedido demasiados enlaces. Espera un rato y vuelve a intentarlo." };
  }

  const token = newToken();
  const code = newCode();
  await db.loginToken.create({
    data: {
      email,
      tokenHash: hashToken(token),
      codeHash: hashToken(`${email}:${code}`),
      expiresAt: new Date(Date.now() + TOKEN_MINUTES * 60 * 1000),
    },
  });
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  try {
    await sendLoginEmail(email, `${appUrl}/auth/verify?token=${encodeURIComponent(token)}`, code);
  } catch (err) {
    console.error("[mail] Error enviando el enlace", err);
    return { status: "error", message: "No se ha podido enviar el correo. Inténtalo de nuevo en unos minutos." };
  }
  return sent;
}

export type CodeState = { error?: string };

// Entrar con el código del correo: sirve cuando el enlace se abre en otra app o navegador
// (por ejemplo, el navegador interno de Gmail) y la sesión se quedaba allí.
export async function loginWithCode(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  const now = new Date();
  const login = await db.loginToken.findFirst({
    where: { email, usedAt: null, expiresAt: { gt: now }, codeHash: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  if (!login || login.attempts >= MAX_CODE_ATTEMPTS) {
    return { error: "El código ha caducado o ya se ha usado. Pide uno nuevo." };
  }
  const expected = Buffer.from(login.codeHash!, "hex");
  const given = Buffer.from(hashToken(`${email}:${code}`), "hex");
  if (code.length !== 6 || !timingSafeEqual(expected, given)) {
    await db.loginToken.update({ where: { id: login.id }, data: { attempts: { increment: 1 } } });
    return { error: "Código incorrecto. Revisa el correo e inténtalo otra vez." };
  }
  // Marcado atómico: el código y el enlace se gastan juntos.
  const { count } = await db.loginToken.updateMany({ where: { id: login.id, usedAt: null }, data: { usedAt: now } });
  const user = await db.user.findUnique({ where: { email } });
  if (count !== 1 || !user) return { error: "El código ha caducado o ya se ha usado. Pide uno nuevo." };
  await createSession(user.id);
  redirect("/");
}
