import { exchangeCode, refreshTokens } from "@/lib/oauth";

const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const get = (k: string) => (form?.get(k) ?? "").toString();
  const clientId = get("client_id");
  let result;
  if (get("grant_type") === "authorization_code") {
    result = await exchangeCode({ code: get("code"), clientId, redirectUri: get("redirect_uri"), verifier: get("code_verifier") });
  } else if (get("grant_type") === "refresh_token") {
    result = await refreshTokens({ refreshToken: get("refresh_token"), clientId });
  } else {
    return Response.json({ error: "unsupported_grant_type" }, { status: 400, headers: noStore });
  }
  return Response.json(result, { status: "error" in result ? 400 : 200, headers: noStore });
}
