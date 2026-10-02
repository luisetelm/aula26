import { appUrl } from "@/lib/oauth";

// Metadatos del servidor de autorización (RFC 8414).
export function GET() {
  const base = appUrl();
  return Response.json(
    {
      issuer: base,
      authorization_endpoint: `${base}/oauth/authorize`,
      token_endpoint: `${base}/api/oauth/token`,
      registration_endpoint: `${base}/api/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
    },
    { headers: { "Access-Control-Allow-Origin": "*" } },
  );
}
