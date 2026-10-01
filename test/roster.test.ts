import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { parseCsv, parseRosterFile } from "@/lib/roster-file";
import { detectColumns, toEntries } from "@/lib/roster";

async function xlsx(rows: unknown[][]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Alumnos");
  rows.forEach((r) => ws.addRow(r));
  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}

describe("roster", () => {
  it("lee un Excel con título encima de la cabecera y detecta columnas", async () => {
    const data = await xlsx([
      ["Listado 3º ESO A"],
      ["Apellidos", "Nombre", "Correo electrónico"],
      ["García López", "Ana", "Ana.Garcia@Escuela.es"],
      ["Pérez", "Luis", "luis.perez@escuela.es"],
      ["Sin correo", "X", ""],
    ]);
    const sheet = await parseRosterFile("lista.xlsx", data);
    expect(sheet.headers).toEqual(["Apellidos", "Nombre", "Correo electrónico"]);
    expect(sheet.rows).toHaveLength(2);
    const map = detectColumns(sheet);
    expect(map).toEqual({ email: 2, firstName: 1, lastName: 0, role: -1 });
    const { valid } = toEntries(sheet, map);
    expect(valid[0]).toEqual({ email: "ana.garcia@escuela.es", firstName: "Ana", lastName: "García López", role: "STUDENT" });
  });

  it("lee celdas con hipervínculo mailto", async () => {
    const data = await xlsx([["Email"], [{ text: "a@b.es", hyperlink: "mailto:a@b.es" }]]);
    const sheet = await parseRosterFile("l.xlsx", data);
    expect(toEntries(sheet, detectColumns(sheet)).valid[0].email).toBe("a@b.es");
  });

  it("parsea CSV con punto y coma y comillas", () => {
    expect(parseCsv('Nombre;Correo\n"Ruiz; Ana";a@b.es\r\n')).toEqual([["Nombre", "Correo"], ["Ruiz; Ana", "a@b.es"]]);
  });

  it("marca profesores por la columna rol, quita duplicados y señala inválidos", () => {
    const sheet = {
      headers: ["Correo", "Rol"],
      rows: [["p@e.es", "Profesor"], ["a@e.es", "Alumno"], ["A@e.es", "Alumno"], ["no-es-correo@", "Alumno"]],
    };
    const { valid, invalid } = toEntries(sheet, detectColumns(sheet));
    expect(valid.map((v) => v.role)).toEqual(["TEACHER", "STUDENT"]);
    expect(invalid).toEqual([{ row: 4, value: "no-es-correo@" }]);
  });

  it("detecta la columna de correo sin cabecera reconocible", () => {
    const sheet = { headers: ["A", "B"], rows: [["Ana", "ana@e.es"]] };
    expect(detectColumns(sheet).email).toBe(1);
  });
});
