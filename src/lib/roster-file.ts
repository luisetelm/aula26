import "server-only";
import ExcelJS from "exceljs";
import type { Sheet } from "./roster";

const MAX_ROWS = 2000;

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object") {
    if ("text" in v && typeof v.text === "string") return v.text; // hipervínculo (mailto:)
    if ("result" in v) return String(v.result ?? ""); // fórmula
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if (v instanceof Date) return v.toISOString().slice(0, 10);
  }
  return String(v);
}

export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export async function parseRosterFile(name: string, data: ArrayBuffer): Promise<Sheet> {
  let matrix: string[][];
  if (/\.csv$/i.test(name)) {
    matrix = parseCsv(new TextDecoder("utf-8").decode(data).replace(/^\uFEFF/, ""));
  } else {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(data);
    const ws = wb.worksheets[0];
    if (!ws) throw new Error("El archivo no tiene hojas.");
    matrix = [];
    ws.eachRow({ includeEmpty: false }, (r) => {
      const values: string[] = [];
      for (let c = 1; c <= r.cellCount; c++) values.push(cellText(r.getCell(c).value).trim());
      matrix.push(values);
    });
  }
  matrix = matrix.map((r) => r.map((c) => c.trim())).filter((r) => r.some(Boolean));
  if (matrix.length === 0) throw new Error("El archivo está vacío.");

  // La cabecera es la última fila sin correos antes del primer correo (puede haber títulos encima).
  const hasEmail = (r: string[]) => r.some((c) => c.includes("@"));
  const firstEmail = matrix.findIndex(hasEmail);
  const headerIdx = firstEmail > 0 ? firstEmail - 1 : -1;
  const headers = headerIdx >= 0 ? matrix[headerIdx] : [];
  const body = matrix.slice(headerIdx + 1).filter(hasEmail);
  const width = Math.max(headers.length, ...body.map((r) => r.length));
  const pad = (r: string[]) => Array.from({ length: width }, (_, i) => r[i] ?? "");
  return {
    headers: pad(headers).map((h, i) => h || `Columna ${i + 1}`),
    rows: body.slice(0, MAX_ROWS).map(pad),
  };
}

