"use client";

import { useRef, useState, useTransition } from "react";
import { addAssessmentAction, addMaterialAction, type MaterialForm } from "../actions";
import { uploadFile } from "../upload";

const MAX_MB = 50;

function useSubmit() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (form: HTMLFormElement, fn: () => Promise<{ error?: string }>) => {
    setError(null);
    start(async () => {
      try {
        const res = await fn();
        if (res.error) setError(res.error);
        else form.reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Algo ha fallado");
      }
    });
  };
  return { pending, error, run };
}

function fileFrom(form: HTMLFormElement) {
  const f = (form.elements.namedItem("file") as HTMLInputElement | null)?.files?.[0];
  if (f && f.size > MAX_MB * 1024 * 1024) throw new Error(`El archivo supera ${MAX_MB} MB`);
  return f ?? null;
}

const val = (form: HTMLFormElement, name: string) =>
  ((form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? "").trim();

export function MaterialFormView({ subjectId, lessonId }: { subjectId: string; lessonId: string }) {
  const [kind, setKind] = useState<MaterialForm["kind"]>("FILE");
  const { pending, error, run } = useSubmit();
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={ref}
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        run(form, async () => {
          const title = val(form, "title");
          const publishAt = val(form, "publishAt");
          let input: MaterialForm;
          if (kind === "FILE") {
            const file = fileFrom(form);
            if (!file) return { error: "Elige un archivo." };
            input = { kind, title: title || file.name, fileId: await uploadFile(subjectId, file) };
          } else if (kind === "LINK") input = { kind, title, url: val(form, "url") };
          else input = { kind, title, body: val(form, "body") };
          const isSlides = kind !== "TEXT" && (form.elements.namedItem("isSlides") as HTMLInputElement | null)?.checked === true;
          return addMaterialAction(subjectId, lessonId, { ...input, publishAt, isSlides });
        });
      }}
      className="space-y-3"
    >
      <div className="flex flex-wrap gap-3">
        <select value={kind} onChange={(e) => setKind(e.target.value as MaterialForm["kind"])} className="input">
          <option value="FILE">Archivo</option>
          <option value="LINK">Enlace</option>
          <option value="TEXT">Texto</option>
        </select>
        <input name="title" required={kind !== "FILE"} placeholder={kind === "FILE" ? "Título (opcional)" : "Título"} className="input flex-1" />
      </div>
      {kind === "FILE" && <input name="file" type="file" required className="text-sm" />}
      {kind === "LINK" && <input name="url" type="url" required placeholder="https://…" className="input w-full" />}
      {kind === "TEXT" && <textarea name="body" required rows={4} placeholder="Admite Markdown" className="input w-full font-mono text-sm" />}
      {kind !== "TEXT" && (
        <label className="flex items-center gap-2 text-sm">
          <input name="isSlides" type="checkbox" />
          Son las diapositivas de la sesión
        </label>
      )}
      <label className="flex flex-wrap items-center gap-2 text-sm text-gris">
        Publicar desde (vacío = el día de la sesión)
        <input name="publishAt" type="datetime-local" className="input py-1" />
      </label>
      {error && <p className="text-sm text-aviso">{error}</p>}
      <button disabled={pending} className="btn-primary">{pending ? "Guardando…" : "Añadir material"}</button>
    </form>
  );
}

export function AssessmentFormView({ subjectId, lessonId }: { subjectId: string; lessonId: string }) {
  const { pending, error, run } = useSubmit();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        run(form, async () => {
          const file = fileFrom(form);
          return addAssessmentAction(subjectId, lessonId, {
            title: val(form, "title"),
            instructions: val(form, "instructions"),
            dueAt: val(form, "dueAt"),
            weight: Number(val(form, "weight") || 0),
            rubric: val(form, "rubric"),
            acceptsSubmissions: (form.elements.namedItem("acceptsSubmissions") as HTMLInputElement).checked,
            acceptsLink: (form.elements.namedItem("acceptsLink") as HTMLInputElement).checked,
            allowedExtensions: val(form, "allowedExtensions"),
            gradingMode: val(form, "gradingMode") === "COMPLETION" ? "COMPLETION" : "SCORE",
            fileId: file ? await uploadFile(subjectId, file) : null,
            publishAt: val(form, "publishAt"),
          });
        });
      }}
      className="space-y-3"
    >
      <input name="title" required placeholder="Título de la tarea" className="input w-full" />
      <textarea name="instructions" rows={4} placeholder="Enunciado (admite Markdown)" className="input w-full font-mono text-sm" />
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col">
          Fecha límite
          <input name="dueAt" type="datetime-local" className="input mt-1" />
        </label>
        <label className="flex flex-col">
          Peso en la nota (%)
          <input name="weight" type="number" min={0} max={100} step="0.5" defaultValue={0} className="input mt-1 w-24" />
        </label>
        <label className="flex flex-col">
          Evaluación
          <select name="gradingMode" className="input mt-1" defaultValue="SCORE">
            <option value="SCORE">Nota de 0 a 10</option>
            <option value="COMPLETION">Entregada / no entregada</option>
          </select>
        </label>
      </div>
      <fieldset className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <legend className="mb-1 font-medium">Entrega del alumnado</legend>
        <label className="flex items-center gap-2">
          <input name="acceptsSubmissions" type="checkbox" /> Archivos
        </label>
        <label className="flex items-center gap-2">
          Solo
          <input name="allowedExtensions" placeholder="pdf, fig" className="input w-32 py-1" />
          <span className="text-gris">(vacío = cualquiera)</span>
        </label>
        <label className="flex items-center gap-2">
          <input name="acceptsLink" type="checkbox" /> Enlace (Figma, web…)
        </label>
      </fieldset>
      <textarea name="rubric" rows={3} placeholder="Rúbrica o criterios de evaluación (solo los ve el profesorado)" className="input w-full text-sm" />
      <div className="flex flex-wrap items-center gap-3 text-sm text-gris">
        <label>Archivo adjunto (opcional) <input name="file" type="file" className="ml-2" /></label>
      </div>
      <label className="flex flex-wrap items-center gap-2 text-sm text-gris">
        Publicar desde (vacío = el día de la sesión)
        <input name="publishAt" type="datetime-local" className="input py-1" />
      </label>
      {error && <p className="text-sm text-aviso">{error}</p>}
      <button disabled={pending} className="btn-primary">{pending ? "Guardando…" : "Añadir tarea"}</button>
    </form>
  );
}
