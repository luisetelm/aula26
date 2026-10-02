import { appUrl, mcpUrl } from "@/lib/oauth";

// Metadatos del recurso protegido (RFC 9728): dónde está el servidor de autorización.
export function GET() {
  return Response.json(
    { resource: mcpUrl(), authorization_servers: [appUrl()], bearer_methods_supported: ["header"], resource_name: "Aula26" },
    { headers: { "Access-Control-Allow-Origin": "*" } },
  );
}
