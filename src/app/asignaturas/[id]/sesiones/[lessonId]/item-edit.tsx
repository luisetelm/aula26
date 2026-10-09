"use client";

import { useActionState, useEffect, useRef } from "react";
import { updateAssessmentAction, updateMaterialAction } from "../actions";

type Result = { error?: string; ok?: boolean };

// «Editar» desplegable: al guardar bien se cierra y la página se refresca con los cambios.
function EditBox({ action, children }: { action: (prev: Result, f: FormData) => Promise<Result>; children: React.ReactNode }) {
  const [state, run, pending] = useActionState(action, {});
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (state.ok && ref.current) ref.current.open = false;
  }, [state]);
  return (
    <details ref={ref} className="group w-full">
      <summary className="cursor-pointer list-none text-acento hover:underline group-open:mb-3">Editar</summary>
      <form action={run} className="space-y-3">
        {children}
        {state.error && <p className="text-sm text-aviso">{state.error}</p>}
        <button disabled={pending} className="btn-primary">{pending ? "Guardando…" : "Guardar cambios"}</button>
      </form>
    </details>
  );
}

const publishField = (value: string) => (
  <label className="flex flex-wrap items-center gap-2 text-sm text-gris">
    Publicar desde (vacío = el día de la sesión)
    <input name="publishAt" type="datetime-local" defaultValue={value} className="input py-1" />
  </label>
);

export function EditMaterial({ subjectId, m }: {
  subjectId: string;
  m: { id: string; kind: "FILE" | "LINK" | "TEXT"; title: string; body: string; url: string | null; isSlides: boolean; publishAt: string };
}) {
  return (
    <EditBox action={(_, f) => updateMaterialAction(subjectId, m.id, f)}>
      <input name="title" required defaultValue={m.title} aria-label="Título" className="input w-full" />
      {m.kind === "TEXT" && <textarea name="body" required rows={10} defaultValue={m.body} aria-label="Texto" className="input w-full font-mono text-sm" />}
      {m.kind === "LINK" && <input name="url" type="url" required defaultValue={m.url ?? ""} aria-label="Enlace" className="input w-full" />}
      {m.kind === "FILE" && <p className="text-sm text-gris">Para cambiar el archivo, quita este material y sube el nuevo.</p>}
      {m.kind !== "TEXT" && (
        <label className="flex items-center gap-2 text-sm">
          <input type="hidden" name="slidesField" value="1" />
          <input name="isSlides" type="checkbox" defaultChecked={m.isSlides} />
          Son las diapositivas de la sesión
        </label>
      )}
      {publishField(m.publishAt)}
    </EditBox>
  );
}

export function EditAssessment({ subjectId, a }: {
  subjectId: string;
  a: {
    id: string; title: string; instructions: string; dueAt: string; weight: number; rubric: string; acceptsSubmissions: boolean;
    acceptsLink: boolean; allowedExtensions: string; gradingMode: "SCORE" | "COMPLETION"; publishAt: string;
  };
}) {
  return (
    <EditBox action={(_, f) => updateAssessmentAction(subjectId, a.id, f)}>
      <input name="title" required defaultValue={a.title} aria-label="Título" className="input w-full" />
      <textarea name="instructions" rows={8} defaultValue={a.instructions} placeholder="Enunciado (admite Markdown)" className="input w-full font-mono text-sm" />
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col">
          Fecha límite
          <input name="dueAt" type="datetime-local" defaultValue={a.dueAt} className="input mt-1" />
        </label>
        <label className="flex flex-col">
          Peso en la nota (%)
          <input name="weight" type="number" min={0} max={100} step="0.5" defaultValue={a.weight} className="input mt-1 w-24" />
        </label>
        <label className="flex flex-col">
          Evaluación
          <select name="gradingMode" className="input mt-1" defaultValue={a.gradingMode}>
            <option value="SCORE">Nota de 0 a 10</option>
            <option value="COMPLETION">Entregada / no entregada</option>
          </select>
        </label>
      </div>
      <fieldset className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <legend className="mb-1 font-medium">Entrega del alumnado</legend>
        <label className="flex items-center gap-2">
          <input name="acceptsSubmissions" type="checkbox" defaultChecked={a.acceptsSubmissions} /> Archivos
        </label>
        <label className="flex items-center gap-2">
          Solo
          <input name="allowedExtensions" defaultValue={a.allowedExtensions} placeholder="pdf, fig" className="input w-32 py-1" />
        </label>
        <label className="flex items-center gap-2">
          <input name="acceptsLink" type="checkbox" defaultChecked={a.acceptsLink} /> Enlace (Figma, web…)
        </label>
      </fieldset>
      <textarea name="rubric" rows={5} defaultValue={a.rubric} placeholder="Rúbrica o criterios de evaluación (solo los ve el profesorado)" className="input w-full text-sm" />
      {publishField(a.publishAt)}
    </EditBox>
  );
}
