"use client";

import { startUploadAction } from "./actions";

type Meta = { name: string; size: number; mimeType: string };
type Target = { fileId: string; url: string; headers: Record<string, string> };

// Sube un archivo directamente al almacenamiento y devuelve su id.
export async function uploadWith(start: (meta: Meta) => Promise<Target>, file: File): Promise<string> {
  const target = await start({ name: file.name, size: file.size, mimeType: file.type || "application/octet-stream" });
  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", file);
  const res = await fetch(target.url, { method: "PUT", headers: { ...target.headers, "x-upsert": "false" }, body });
  if (!res.ok) throw new Error(`Error ${res.status} al subir el archivo`);
  return target.fileId;
}

export function uploadFile(subjectId: string, file: File): Promise<string> {
  return uploadWith((meta) => startUploadAction(subjectId, meta), file);
}
