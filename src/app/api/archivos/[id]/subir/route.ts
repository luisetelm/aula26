import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { usingSupabase, writeLocal } from "@/lib/storage";
import { hashToken } from "@/lib/tokens";

// Subida al disco local, solo cuando no hay Supabase configurado (desarrollo).
export async function PUT(req: NextRequest, ctx: RouteContext<"/api/archivos/[id]/subir">) {
  if (usingSupabase()) return new Response("No disponible", { status: 404 });
  const { id } = await ctx.params;
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const file = await db.storedFile.findUnique({ where: { id } });
  if (!file || file.uploadedAt || file.uploadTokenHash !== hashToken(token)) {
    return new Response("No autorizado", { status: 403 });
  }
  const form = await req.formData();
  const blob = [...form.values()].find((v): v is File => v instanceof File);
  if (!blob || blob.size > file.size) return new Response("Archivo no válido", { status: 400 });
  await writeLocal(file.storageKey, Buffer.from(await blob.arrayBuffer()));
  await db.storedFile.update({ where: { id }, data: { uploadedAt: new Date(), uploadTokenHash: null } });
  return Response.json({ ok: true });
}
