import "server-only";
import JSZip from "jszip";
import { compileSchema, decodeBinarySchema } from "kiwi-schema";
import { inflateRaw } from "pako";
import { decompress as zstd } from "fzstd";

// Lectura de archivos .fig de Figma ("Guardar copia local") para que Claude pueda evaluarlos.
// Un .fig es un ZIP con canvas.fig (formato binario kiwi: cabecera, esquema comprimido y datos
// comprimidos) y thumbnail.png. Los .fig antiguos son directamente el binario, sin ZIP.

type Guid = { sessionID: number; localID: number };
type Paint = { type?: string; color?: { r: number; g: number; b: number; a: number }; visible?: boolean; opacity?: number };
type FigNode = {
  guid?: Guid;
  parentIndex?: { guid: Guid; position: string };
  type?: string;
  name?: string;
  visible?: boolean;
  size?: { x: number; y: number };
  textData?: { characters?: string };
  fontName?: { family: string; style: string };
  fontSize?: number;
  fillPaints?: Paint[];
  stackMode?: string;
  internalOnly?: boolean;
  symbolData?: { symbolID?: Guid };
  [k: string]: unknown;
};

const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd];

function unpack(chunk: Uint8Array) {
  if (ZSTD_MAGIC.every((b, i) => chunk[i] === b)) return zstd(chunk);
  return inflateRaw(chunk);
}

export function parseCanvas(buf: Uint8Array) {
  const prelude = new TextDecoder().decode(buf.subarray(0, 8));
  if (!/^fig-/.test(prelude)) throw new Error("No es un archivo de Figma");
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const chunks: Uint8Array[] = [];
  let offset = 12; // 8 de prelude + 4 de versión
  while (offset + 4 <= buf.length) {
    const len = view.getUint32(offset, true);
    offset += 4;
    chunks.push(buf.subarray(offset, offset + len));
    offset += len;
  }
  if (chunks.length < 2) throw new Error("Archivo de Figma incompleto");
  const schema = compileSchema(decodeBinarySchema(unpack(chunks[0])));
  const message = schema.decodeMessage(unpack(chunks[1])) as { nodeChanges?: FigNode[] };
  return { prelude, nodes: message.nodeChanges ?? [] };
}

const id = (g?: Guid) => (g ? `${g.sessionID}:${g.localID}` : "");
const hex = (c: { r: number; g: number; b: number }) =>
  "#" + [c.r, c.g, c.b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
const px = (n: number) => Math.round(n);

const CONTAINERS = new Set(["FRAME", "GROUP", "SECTION", "SYMBOL", "INSTANCE", "BOOLEAN_OPERATION"]);
const MAX_LINES = 700;

export function summarizeFig(nodes: FigNode[]) {
  const byId = new Map(nodes.map((n) => [id(n.guid), n]));
  const children = new Map<string, FigNode[]>();
  for (const n of nodes) {
    const p = id(n.parentIndex?.guid);
    if (!p) continue;
    if (!children.has(p)) children.set(p, []);
    children.get(p)!.push(n);
  }
  for (const list of children.values()) list.sort((a, b) => ((a.parentIndex?.position ?? "") < (b.parentIndex?.position ?? "") ? -1 : 1));

  const lines: string[] = [];
  const walk = (n: FigNode, depth: number) => {
    if (lines.length >= MAX_LINES || n.visible === false) return;
    const pad = "  ".repeat(depth);
    const size = n.size && CONTAINERS.has(n.type ?? "") ? ` ${px(n.size.x)}×${px(n.size.y)}` : "";
    const auto = n.stackMode && n.stackMode !== "NONE" ? ` auto layout ${n.stackMode === "VERTICAL" ? "vertical" : "horizontal"}` : "";
    if (n.type === "TEXT") {
      const t = (n.textData?.characters ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
      const font = n.fontName ? ` [${n.fontName.family} ${n.fontName.style}${n.fontSize ? ` ${px(n.fontSize)}` : ""}]` : "";
      lines.push(`${pad}- Texto${font}: «${t}»`);
      return;
    }
    const comp = n.type === "INSTANCE" ? ` (instancia de «${byId.get(id(n.symbolData?.symbolID))?.name ?? "?"}»)` : "";
    lines.push(`${pad}- ${n.type?.toLowerCase() ?? "nodo"} «${n.name ?? ""}»${size}${auto}${comp}`);
    if (CONTAINERS.has(n.type ?? "") || n.type === "CANVAS") for (const c of children.get(id(n.guid)) ?? []) walk(c, depth + 1);
  };

  const pages = nodes.filter((n) => n.type === "CANVAS" && !n.internalOnly && !/internal only/i.test(n.name ?? ""));
  for (const p of pages) {
    if (lines.length >= MAX_LINES) break;
    lines.push(`\n## Página «${p.name}»`);
    for (const c of children.get(id(p.guid)) ?? []) walk(c, 0);
  }
  if (lines.length >= MAX_LINES) lines.push("\n(Estructura recortada: el archivo es muy grande.)");

  const count = (t: string) => nodes.filter((n) => n.type === t).length;
  const fonts = new Map<string, number>();
  const colors = new Map<string, number>();
  for (const n of nodes) {
    if (n.fontName) fonts.set(`${n.fontName.family} ${n.fontName.style}`, (fonts.get(`${n.fontName.family} ${n.fontName.style}`) ?? 0) + 1);
    for (const f of n.fillPaints ?? []) {
      if (f.type === "SOLID" && f.color && f.visible !== false) colors.set(hex(f.color), (colors.get(hex(f.color)) ?? 0) + 1);
    }
  }
  const top = (m: Map<string, number>, k: number) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k).map(([v, c]) => `${v} (${c})`).join(", ");
  const interactions = nodes.filter((n) => Object.entries(n).some(([k, v]) => /interaction/i.test(k) && Array.isArray(v) && v.length > 0)).length;
  const symbols = nodes.filter((n) => n.type === "SYMBOL").map((n) => n.name);

  const head = [
    `# Resumen del archivo de Figma`,
    `Páginas: ${pages.map((p) => `«${p.name}»`).join(", ") || "ninguna"}`,
    `Frames: ${count("FRAME")} · Textos: ${count("TEXT")} · Componentes: ${symbols.length} · Instancias: ${count("INSTANCE")}`,
    `Frames con auto layout: ${nodes.filter((n) => n.stackMode && n.stackMode !== "NONE").length}`,
    `Elementos con interacciones de prototipo: ${interactions}`,
    `Tipografías (usos): ${top(fonts, 10) || "—"}`,
    `Colores de relleno más usados: ${top(colors, 12) || "—"}`,
    symbols.length ? `Componentes: ${symbols.slice(0, 40).map((s) => `«${s}»`).join(", ")}` : "",
  ].filter(Boolean);
  return [...head, "\n# Estructura (capas visibles)", ...lines].join("\n");
}

export async function readFig(data: Buffer) {
  let canvas: Uint8Array = data;
  let thumbnail: Buffer | null = null;
  if (data[0] === 0x50 && data[1] === 0x4b) {
    const zip = await JSZip.loadAsync(data);
    const c = zip.file("canvas.fig");
    if (!c) throw new Error("El ZIP no contiene canvas.fig");
    canvas = await c.async("uint8array");
    const t = zip.file("thumbnail.png");
    if (t) thumbnail = Buffer.from(await t.async("uint8array"));
  }
  const { nodes } = parseCanvas(canvas);
  return { summary: summarizeFig(nodes), thumbnail };
}
