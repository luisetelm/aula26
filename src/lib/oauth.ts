import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import type { User } from "@prisma/client";
import { db } from "./db";
import { hashToken, newToken } from "./tokens";

// Servidor OAuth 2.1 mínimo para el conector de Claude: registro dinámico de clientes,
// código de autorización con PKCE (S256) y tokens opacos con refresco. Solo guardamos hashes.

export const ACCESS_SECONDS = 60 * 60;
const REFRESH_DAYS = 60;
const CODE_MINUTES = 5;

export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const mcpUrl = () => `${appUrl()}/api/mcp`;

// Solo aceptamos volver a Claude (web y escritorio) o a una app local (Claude Code, pruebas).
export function allowedRedirect(uri: string) {
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.hash) return false;
  if (u.protocol === "http:") return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  return u.protocol === "https:" && ["claude.ai", "claude.com"].includes(u.hostname);
}

export async function registerClient(name: string, redirectUris: string[]) {
  return db.oAuthClient.create({ data: { name: name.slice(0, 200), redirectUris } });
}

export async function getClient(clientId: string) {
  return db.oAuthClient.findUnique({ where: { id: clientId } });
}

export async function createCode(input: { clientId: string; userId: string; redirectUri: string; codeChallenge: string }) {
  const code = newToken();
  await db.oAuthCode.create({
    data: { ...input, codeHash: hashToken(code), expiresAt: new Date(Date.now() + CODE_MINUTES * 60 * 1000) },
  });
  return code;
}

export function pkceMatches(verifier: string, challenge: string) {
  const expected = Buffer.from(createHash("sha256").update(verifier).digest("base64url"));
  const given = Buffer.from(challenge);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

async function issueTokens(clientId: string, userId: string) {
  const access = newToken();
  const refresh = newToken();
  const now = Date.now();
  await db.oAuthToken.createMany({
    data: [
      { kind: "ACCESS", tokenHash: hashToken(access), clientId, userId, expiresAt: new Date(now + ACCESS_SECONDS * 1000) },
      { kind: "REFRESH", tokenHash: hashToken(refresh), clientId, userId, expiresAt: new Date(now + REFRESH_DAYS * 86400 * 1000) },
    ],
  });
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_SECONDS, refresh_token: refresh };
}

export type TokenError = { error: "invalid_grant" | "invalid_request" | "invalid_client" };

export async function exchangeCode(p: { code: string; clientId: string; redirectUri: string; verifier: string }) {
  const now = new Date();
  const codeHash = hashToken(p.code);
  // Marcado atómico: un código solo se canjea una vez.
  const { count } = await db.oAuthCode.updateMany({
    where: { codeHash, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (count !== 1) return { error: "invalid_grant" } as TokenError;
  const c = await db.oAuthCode.findUnique({ where: { codeHash } });
  if (!c || c.clientId !== p.clientId || c.redirectUri !== p.redirectUri || !pkceMatches(p.verifier, c.codeChallenge)) {
    return { error: "invalid_grant" } as TokenError;
  }
  return issueTokens(c.clientId, c.userId);
}

// Rotación: el token de refresco viejo se borra y se emite un par nuevo.
export async function refreshTokens(p: { refreshToken: string; clientId: string }) {
  const tokenHash = hashToken(p.refreshToken);
  const t = await db.oAuthToken.findUnique({ where: { tokenHash } });
  if (!t || t.kind !== "REFRESH" || t.clientId !== p.clientId || t.expiresAt < new Date()) {
    return { error: "invalid_grant" } as TokenError;
  }
  const { count } = await db.oAuthToken.deleteMany({ where: { id: t.id } });
  if (count !== 1) return { error: "invalid_grant" } as TokenError;
  return issueTokens(t.clientId, t.userId);
}

export async function userForAccessToken(token: string) {
  const t = await db.oAuthToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!t || t.kind !== "ACCESS" || t.expiresAt < new Date()) return null;
  return t.user;
}

// Conexiones activas del usuario (para poder desconectarlas desde Aula26).
export async function listConnections(userId: string) {
  const tokens = await db.oAuthToken.findMany({
    where: { userId, kind: "REFRESH", expiresAt: { gt: new Date() } },
    include: { client: true },
    orderBy: { createdAt: "desc" },
  });
  // "since" es la última renovación del token: cuándo se usó por última vez, más o menos.
  const byClient = new Map<string, { clientId: string; name: string; since: Date }>();
  for (const t of tokens) {
    if (!byClient.has(t.clientId)) byClient.set(t.clientId, { clientId: t.clientId, name: t.client.name, since: t.createdAt });
  }
  return [...byClient.values()];
}

export async function revokeConnection(userId: string, clientId: string) {
  await db.oAuthToken.deleteMany({ where: { userId, clientId } });
}

// El conector es para el profesorado (y administración).
export async function canUseConnector(user: User) {
  if (user.isAdmin) return true;
  return (await db.enrollment.count({ where: { userId: user.id, role: "TEACHER" } })) > 0;
}
