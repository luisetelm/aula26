import { describe, expect, it } from "vitest";
import { deflateRawSync, zstdCompressSync } from "node:zlib";
import JSZip from "jszip";
import { compileSchema, encodeBinarySchema, parseSchema } from "kiwi-schema";
import { readFig } from "@/lib/fig";

// .fig sintético con el mismo formato que Figma: esquema kiwi + mensaje con nodeChanges.
const SCHEMA = `
struct GUID { uint sessionID; uint localID; }
struct ParentIndex { GUID guid; string position; }
struct Vector { float x; float y; }
struct Color { float r; float g; float b; float a; }
struct FontName { string family; string style; }
message TextData { string characters = 1; }
message Paint { string type = 1; Color color = 2; bool visible = 3; }
message SymbolData { GUID symbolID = 1; }
message NodeChange {
  GUID guid = 1; ParentIndex parentIndex = 2; string type = 3; string name = 4; Vector size = 5;
  TextData textData = 6; FontName fontName = 7; float fontSize = 8; Paint[] fillPaints = 9;
  string stackMode = 10; SymbolData symbolData = 11; bool internalOnly = 12;
}
message Message { NodeChange[] nodeChanges = 1; }
`;

const g = (localID: number) => ({ sessionID: 0, localID });
const under = (localID: number, position: string) => ({ guid: g(localID), position });
const NODES = [
  { guid: g(0), type: "DOCUMENT", name: "Document" },
  { guid: g(1), parentIndex: under(0, "a"), type: "CANVAS", name: "Pantallas" },
  { guid: g(9), parentIndex: under(0, "b"), type: "CANVAS", name: "Internal Only Canvas", internalOnly: true },
  { guid: g(2), parentIndex: under(1, "b"), type: "FRAME", name: "Inicio", size: { x: 390, y: 844 }, stackMode: "VERTICAL",
    fillPaints: [{ type: "SOLID", color: { r: 1, g: 1, b: 1, a: 1 }, visible: true }] },
  { guid: g(3), parentIndex: under(2, "a"), type: "TEXT", name: "Titulo", textData: { characters: "Bienvenida  al\nportal" },
    fontName: { family: "Inter", style: "Bold" }, fontSize: 32 },
  { guid: g(4), parentIndex: under(1, "a"), type: "SYMBOL", name: "Botón primario", size: { x: 120, y: 44 } },
  { guid: g(5), parentIndex: under(2, "b"), type: "INSTANCE", name: "CTA", size: { x: 120, y: 44 }, symbolData: { symbolID: g(4) } },
];

function canvas(dataCompress: (b: Uint8Array) => Uint8Array) {
  const def = parseSchema(SCHEMA);
  const schemaBin = deflateRawSync(encodeBinarySchema(def));
  const data = dataCompress(compileSchema(def).encodeMessage({ nodeChanges: NODES }));
  const parts = [Buffer.from("fig-kiwi"), u32(48)];
  for (const c of [schemaBin, data]) parts.push(u32(c.length), Buffer.from(c));
  return Buffer.concat(parts);
}
function u32(n: number) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
}

describe("readFig", () => {
  it("lee un canvas.fig suelto con datos en deflate", async () => {
    const { summary, thumbnail } = await readFig(canvas((b) => deflateRawSync(b)));
    expect(thumbnail).toBeNull();
    expect(summary).toContain("Páginas: «Pantallas»");
    expect(summary).not.toContain("Internal Only");
    expect(summary).toContain("frame «Inicio» 390×844 auto layout vertical");
    expect(summary).toContain("Texto [Inter Bold 32]: «Bienvenida al portal»");
    expect(summary).toContain("instancia de «Botón primario»");
    expect(summary).toContain("#FFFFFF (1)");
    // El componente (posición "a") va antes que el frame (posición "b").
    expect(summary.indexOf("symbol «Botón primario»")).toBeLessThan(summary.indexOf("frame «Inicio»"));
  });

  it("lee el ZIP de Figma con datos en zstd y miniatura", async () => {
    const zip = new JSZip();
    zip.file("canvas.fig", canvas((b) => zstdCompressSync(b)));
    zip.file("thumbnail.png", Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const { summary, thumbnail } = await readFig(await zip.generateAsync({ type: "nodebuffer" }));
    expect(summary).toContain("Frames: 1 · Textos: 1 · Componentes: 1 · Instancias: 1");
    expect(thumbnail?.length).toBe(4);
  });

  it("rechaza archivos que no son de Figma", async () => {
    await expect(readFig(Buffer.from("hola, esto no es un fig"))).rejects.toThrow("No es un archivo de Figma");
  });
});
