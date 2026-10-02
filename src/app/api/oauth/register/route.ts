import { z } from "zod";
import { allowedRedirect, registerClient } from "@/lib/oauth";

// Registro dinámico de clientes (RFC 7591). Solo clientes públicos con PKCE.
const body = z.object({
  redirect_uris: z.array(z.string()).min(1).max(10),
  client_name: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_client_metadata" }, { status: 400 });
  const { redirect_uris, client_name } = parsed.data;
  if (!redirect_uris.every(allowedRedirect)) return Response.json({ error: "invalid_redirect_uri" }, { status: 400 });
  const client = await registerClient(client_name ?? "", redirect_uris);
  return Response.json(
    {
      client_id: client.id,
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      client_name: client.name,
      redirect_uris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    { status: 201 },
  );
}
