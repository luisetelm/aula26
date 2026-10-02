import "server-only";
import { getClient } from "@/lib/oauth";
export { canUseConnector } from "@/lib/oauth";

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");

// Valida una petición de autorización. Si el cliente o la redirección no cuadran, no volvemos a ella.
export async function checkAuthorizeRequest(raw: Raw) {
  const clientId = str(raw.client_id);
  const redirectUri = str(raw.redirect_uri);
  const client = clientId ? await getClient(clientId) : null;
  if (!client || !client.redirectUris.includes(redirectUri)) return { ok: false as const };
  const codeChallenge = str(raw.code_challenge);
  const valid = str(raw.response_type) === "code" && str(raw.code_challenge_method) === "S256" && /^[\w-]{43,128}$/.test(codeChallenge);
  return { ok: true as const, valid, client, clientId, redirectUri, codeChallenge, state: str(raw.state) };
}
