export type Sheet = { headers: string[]; rows: string[][] };
export type ColumnMap = { email: number; firstName: number; lastName: number; role: number };
export type RosterEntry = { email: string; firstName: string; lastName: string; role: "TEACHER" | "STUDENT" };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

export function detectColumns(sheet: Sheet): ColumnMap {
  const h = sheet.headers.map(norm);
  const find = (re: RegExp, except: number[] = []) => h.findIndex((x, i) => re.test(x) && !except.includes(i));
  let email = find(/correo|e-?mail|mail/);
  if (email < 0) email = sheet.headers.findIndex((_, i) => sheet.rows.some((r) => r[i].includes("@")));
  const lastName = find(/apellido/, [email]);
  const firstName = find(/^nombre|nombre$|^name|first/, [email, lastName]);
  const role = find(/^rol|perfil|tipo/, [email, lastName, firstName]);
  return { email, firstName, lastName, role };
}

// Para listados sin correo: la columna con el nombre completo del alumnado.
export function detectNameColumn(sheet: Sheet) {
  const h = sheet.headers.map(norm);
  const i = h.findIndex((x) => /alumn|estudiante|nombre|name/.test(x));
  return i >= 0 ? i : 0;
}

export function toEntries(sheet: Sheet, map: ColumnMap) {
  const valid: RosterEntry[] = [];
  const invalid: { row: number; value: string }[] = [];
  const seen = new Set<string>();
  sheet.rows.forEach((r, i) => {
    const email = (r[map.email] ?? "").trim().toLowerCase().replace(/^mailto:/, "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      invalid.push({ row: i + 1, value: r[map.email] ?? "" });
      return;
    }
    if (seen.has(email)) return;
    seen.add(email);
    const roleText = map.role >= 0 ? norm(r[map.role] ?? "") : "";
    valid.push({
      email,
      firstName: map.firstName >= 0 ? r[map.firstName] : "",
      lastName: map.lastName >= 0 ? r[map.lastName] : "",
      role: /profe|docente|teacher/.test(roleText) ? "TEACHER" : "STUDENT",
    });
  });
  return { valid, invalid };
}
