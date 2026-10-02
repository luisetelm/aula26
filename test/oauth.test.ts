import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { allowedRedirect, pkceMatches } from "@/lib/oauth";
import { safeNext } from "@/lib/next-path";

describe("conector de Claude", () => {
  it("solo vuelve a Claude o a una app local", () => {
    expect(allowedRedirect("https://claude.ai/api/mcp/auth_callback")).toBe(true);
    expect(allowedRedirect("https://claude.com/api/mcp/auth_callback")).toBe(true);
    expect(allowedRedirect("http://localhost:6274/callback")).toBe(true);
    expect(allowedRedirect("http://claude.ai/cb")).toBe(false);
    expect(allowedRedirect("https://claude.ai.evil.com/cb")).toBe(false);
    expect(allowedRedirect("https://evil.com/cb")).toBe(false);
    expect(allowedRedirect("no es una url")).toBe(false);
  });

  it("comprueba PKCE S256", () => {
    const verifier = "a".repeat(50);
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    expect(pkceMatches(verifier, challenge)).toBe(true);
    expect(pkceMatches("b".repeat(50), challenge)).toBe(false);
  });

  it("después de entrar solo redirige dentro de Aula26", () => {
    expect(safeNext("/oauth/authorize?x=1")).toBe("/oauth/authorize?x=1");
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("/\\evil.com")).toBe("/");
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext(undefined)).toBe("/");
  });
});
