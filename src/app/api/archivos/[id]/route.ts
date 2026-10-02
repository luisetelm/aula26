import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { fileForDownload } from "@/lib/content";
import { downloadUrl, readLocal } from "@/lib/storage";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/archivos/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  const { id } = await ctx.params;
  const file = await fileForDownload(user, id);
  if (!file || !file.uploadedAt) return new Response("No encontrado", { status: 404 });

  const signed = await downloadUrl(file.storageKey, file.name);
  if (signed) return Response.redirect(signed, 302);

  const data = await readLocal(file.storageKey).catch(() => null);
  if (!data) return new Response("No encontrado", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": file.mimeType,
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "cache-control": "private, no-store",
    },
  });
}
