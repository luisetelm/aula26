import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";

// Supabase Storage si está configurado; si no, disco local (solo desarrollo).
const BUCKET = process.env.SUPABASE_BUCKET ?? "aula26";
const LOCAL_DIR = path.join(/* turbopackIgnore: true */ process.cwd(), process.env.LOCAL_UPLOAD_DIR ?? ".uploads");

let client: SupabaseClient | null = null;
function supabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  client ??= createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export type UploadTarget = { url: string; headers: Record<string, string> };

export async function createUploadTarget(storageKey: string, localUploadPath: string): Promise<UploadTarget> {
  const sb = supabase();
  if (!sb) return { url: localUploadPath, headers: {} };
  const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(storageKey);
  if (error) throw error;
  const headers: Record<string, string> = {};
  const anon = process.env.SUPABASE_ANON_KEY;
  if (anon) headers.apikey = anon;
  return { url: data.signedUrl, headers };
}

export async function downloadUrl(storageKey: string, fileName: string): Promise<string | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(storageKey, 60, { download: fileName });
  if (error) throw error;
  return data.signedUrl;
}

export async function removeObject(storageKey: string) {
  const sb = supabase();
  if (sb) await sb.storage.from(BUCKET).remove([storageKey]);
  else await rm(localPath(storageKey), { force: true });
}

function localPath(storageKey: string) {
  const p = path.resolve(LOCAL_DIR, storageKey);
  if (!p.startsWith(LOCAL_DIR + path.sep)) throw new Error("Ruta no válida");
  return p;
}

export async function writeLocal(storageKey: string, data: Buffer) {
  const p = localPath(storageKey);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, data);
}

export function readLocal(storageKey: string) {
  return readFile(localPath(storageKey));
}

export const usingSupabase = () => supabase() !== null;
