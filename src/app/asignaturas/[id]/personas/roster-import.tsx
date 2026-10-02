"use client";

import { useMemo, useState, useTransition } from "react";
import { detectColumns, toEntries, type ColumnMap, type Sheet } from "@/lib/roster";
import { importRoster, previewRoster, type ImportResult } from "./actions";

type RoleMode = "STUDENT" | "TEACHER" | "COLUMN";

const FIELDS: { key: keyof ColumnMap; label: string; required?: boolean }[] = [
  { key: "email", label: "Correo", required: true },
  { key: "firstName", label: "Nombre" },
  { key: "lastName", label: "Apellidos" },
  { key: "role", label: "Rol" },
];

export function RosterImport({ subjectId }: { subjectId: string }) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [map, setMap] = useState<ColumnMap | null>(null);
  const [roleMode, setRoleMode] = useState<RoleMode>("STUDENT");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  const preview = useMemo(() => {
    if (!sheet || !map || map.email < 0) return null;
    const { valid, invalid } = toEntries(sheet, map);
    const entries = roleMode === "COLUMN" ? valid : valid.map((e) => ({ ...e, role: roleMode }));
    return { entries, invalid };
  }, [sheet, map, roleMode]);

  function onFile(formData: FormData) {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await previewRoster(subjectId, formData);
      if (!res.ok) return setError(res.error);
      const detected = detectColumns(res.sheet);
      setSheet(res.sheet);
      setMap(detected);
      setRoleMode(detected.role >= 0 ? "COLUMN" : "STUDENT");
    });
  }

  function onImport() {
    if (!preview) return;
    startTransition(async () => {
      setResult(await importRoster(subjectId, preview.entries));
      setSheet(null);
      setMap(null);
    });
  }

  return (
    <section className="card">
      <h2 className="mb-1 text-lg font-semibold">Importar desde Excel</h2>
      <p className="mb-4 text-sm text-gris">
        Sube el .xlsx o .csv de la escuela. Solo hace falta una columna con el correo; nombre y apellidos son opcionales.
      </p>

      {result && (
        <p className="mb-4 bg-acento-suave p-3 text-sm">
          Hecho: {result.enrolled} personas añadidas a la asignatura ({result.created} nuevas en Aula26)
          {result.alreadyEnrolled > 0 && `, ${result.alreadyEnrolled} ya estaban`}.
        </p>
      )}

      {!sheet && (
        <form action={onFile} className="flex flex-wrap items-center gap-3">
          <input name="file" type="file" accept=".xlsx,.csv" required className="text-sm" />
          <button disabled={pending} className="btn-secondary">{pending ? "Leyendo…" : "Ver vista previa"}</button>
        </form>
      )}
      {error && <p className="mt-3 text-sm text-aviso">{error}</p>}

      {sheet && map && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4">
            {FIELDS.map((f) => (
              <label key={f.key} className="flex flex-col text-sm">
                {f.label}
                <select
                  className="input mt-1"
                  value={map[f.key]}
                  onChange={(ev) => setMap({ ...map, [f.key]: Number(ev.target.value) })}
                >
                  {!f.required && <option value={-1}>(ninguna)</option>}
                  {sheet.headers.map((h, i) => (
                    <option key={i} value={i}>{h}</option>
                  ))}
                </select>
              </label>
            ))}
            <label className="flex flex-col text-sm">
              Importar como
              <select className="input mt-1" value={roleMode} onChange={(ev) => setRoleMode(ev.target.value as RoleMode)}>
                <option value="STUDENT">Todo alumnado</option>
                <option value="TEACHER">Todo profesorado</option>
                <option value="COLUMN" disabled={map.role < 0}>Según la columna Rol</option>
              </select>
            </label>
          </div>

          {preview && (
            <>
              <div className="max-h-72 overflow-auto border border-linea">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-acento-suave text-left">
                    <tr><th className="px-3 py-2">Correo</th><th>Nombre</th><th>Apellidos</th><th>Rol</th></tr>
                  </thead>
                  <tbody>
                    {preview.entries.slice(0, 50).map((e) => (
                      <tr key={e.email} className="border-t border-linea">
                        <td className="px-3 py-1">{e.email}</td>
                        <td>{e.firstName}</td>
                        <td>{e.lastName}</td>
                        <td>{e.role === "TEACHER" ? "Profesor" : "Alumno"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-gris">
                {preview.entries.length} personas listas para importar
                {preview.entries.length > 50 && " (se muestran las 50 primeras)"}.
                {preview.invalid.length > 0 &&
                  ` Se ignorarán ${preview.invalid.length} filas sin correo válido (filas ${preview.invalid
                    .slice(0, 5)
                    .map((r) => r.row)
                    .join(", ")}${preview.invalid.length > 5 ? "…" : ""}).`}
              </p>
            </>
          )}

          <div className="flex gap-3">
            <button onClick={onImport} disabled={pending || !preview?.entries.length} className="btn-primary">
              {pending ? "Importando…" : `Importar ${preview?.entries.length ?? 0} personas`}
            </button>
            <button onClick={() => { setSheet(null); setMap(null); }} className="btn-secondary">Cancelar</button>
          </div>
        </div>
      )}
    </section>
  );
}
