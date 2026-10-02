import { createHash, randomBytes, randomInt } from "node:crypto";

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

// Código de 6 cifras para escribir a mano (se guarda solo su hash).
export function newCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
