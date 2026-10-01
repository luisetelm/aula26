"use client";

import { startUploadAction } from "./actions";

// Sube un archivo directamente al almacenamiento y devuelve su id.
export async function uploadFile(subjectId: string, file: File): Promise<string> {
  const target = await startUploadAction(subjectId, {
    name: file.name,
    size: file.size,
    mimeType: file.type || "application/octet-stream",
  });
  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", file);
  const res = await fetch(target.url, { method: "PUT", headers: { ...target.headers, "x-upsert": "false" }, body });
  if (!res.ok) throw new Error(`Error ${res.status} al subir el archivo`);
  return target.fileId;
}
