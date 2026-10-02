import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { buildMcpServer } from "@/lib/mcp";
import { appUrl, canUseConnector, userForAccessToken } from "@/lib/oauth";

// Conector de Claude (MCP por HTTP, sin estado). Cada petición trae el token del profesor.
async function handle(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const user = token ? await userForAccessToken(token) : null;
  if (!user || !(await canUseConnector(user))) {
    return Response.json(
      { error: "invalid_token" },
      {
        status: 401,
        headers: { "WWW-Authenticate": `Bearer resource_metadata="${appUrl()}/.well-known/oauth-protected-resource/api/mcp"` },
      },
    );
  }
  const server = buildMcpServer(user);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export { handle as GET, handle as POST, handle as DELETE };
