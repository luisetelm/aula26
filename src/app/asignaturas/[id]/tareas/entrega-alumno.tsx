"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icono } from "@/components/icono";
import { acceptAttr, extensionAllowed, showExtensions } from "@/lib/extensions";
import { uploadWith } from "../sesiones/upload";
import { removeSubmissionFileAction, startSubmissionUploadAction, submitAction } from "./actions";

type Archivo = { id: string; name: string; size: number };

export type EntregaProps = {
  subjectId: string;
  assessmentId: string;
  status: "pendiente" | "entregada" | "tarde" | "sin-entregar";
  submittedAt: string | null; // ya formateada
  note: string;
  url: string;
  files: Archivo[];
  acceptsFiles: boolean;
  acceptsLink: boolean;
  allowedExtensions: string;
  completion: boolean; // se valora entregada / no entregada
  graded: boolean;
  grade: number | null;
  feedback: string;
};

const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

// Bloque de entrega del alumno dentro de la tarea (fondo acento).
export function EntregaAlumno(p: EntregaProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const entregada = p.status === "entregada" || p.status === "tarde";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const files = [...((form.elements.namedItem("files") as HTMLInputElement | null)?.files ?? [])];
    const note = (form.elements.namedItem("note") as HTMLTextAreaElement).value;
    const url = ((form.elements.namedItem("url") as HTMLInputElement | null)?.value ?? "").trim();
    if (files.length === 0 && p.files.length === 0 && !note.trim() && !url) return setError("Añade al menos un archivo, un enlace o un comentario.");
    const wrong = files.find((f) => !extensionAllowed(f.name, p.allowedExtensions));
    if (wrong) return setError(`«${wrong.name}» no vale: solo se admiten archivos ${showExtensions(p.allowedExtensions)}.`);
    if (url && !url.startsWith("https://")) return setError("El enlace debe empezar por https://");
    setBusy(true);
    setError(null);
    try {
      const fileIds = [];
      for (const f of files) fileIds.push(await uploadWith((meta) => startSubmissionUploadAction(p.assessmentId, meta), f));
      const res = await submitAction(p.subjectId, p.assessmentId, { fileIds, note, url });
      if (res.error) setError(res.error);
      else {
        formRef.current?.reset();
        router.refresh();
      }
    } catch {
      setError("No se ha podido subir el archivo. Revisa la conexión e inténtalo otra vez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-papel/30 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="etiqueta text-papel!">Tu entrega</span>
        {p.status === "entregada" && <span className="badge text-papel"><Icono nombre="check" className="h-3.5 w-3.5" />Entregada · {p.submittedAt}</span>}
        {p.status === "tarde" && <span className="badge border-ocre bg-ocre text-grafito">Entregada tarde · {p.submittedAt}</span>}
        {p.status === "sin-entregar" && <span className="badge border-ocre bg-ocre text-grafito">Sin entregar · el plazo ha terminado</span>}
        {p.status === "pendiente" && <span className="badge text-papel">Sin entregar</span>}
      </div>

      {p.grade !== null && p.completion && (
        <div className="mt-3 bg-tinta-profunda p-4">
          <p className="text-lg font-semibold">{p.grade > 0 ? "Valorada como entregada" : "Valorada como no entregada"}</p>
          {p.feedback && <p className="mt-2 whitespace-pre-line">{p.feedback}</p>}
        </div>
      )}
      {p.grade !== null && !p.completion && (
        <div className="mt-3 flex flex-wrap items-baseline gap-4 bg-tinta-profunda p-4">
          <span className="font-mono text-4xl font-medium">{p.grade.toLocaleString("es-ES", { maximumFractionDigits: 2 })}</span>
          <span className="text-sm">sobre 10</span>
          {p.feedback && <p className="basis-full whitespace-pre-line">{p.feedback}</p>}
        </div>
      )}
      {p.grade === null && p.feedback && <p className="mt-3 whitespace-pre-line bg-tinta-profunda p-4">{p.feedback}</p>}

      {p.files.length > 0 && (
        <ul className="mt-3 space-y-1">
          {p.files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-3">
              <a href={`/api/archivos/${f.id}`} className="inline-flex items-center gap-2 font-medium underline underline-offset-4">
                <Icono nombre="lectura" className="h-4 w-4" />{f.name}
              </a>
              <span className="text-sm">{kb(f.size)}</span>
              {!p.graded && (
                <button
                  type="button"
                  className="text-sm underline underline-offset-4"
                  onClick={() => startTransition(async () => { await removeSubmissionFileAction(p.subjectId, f.id); router.refresh(); })}
                >
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {p.url && (
        <a href={p.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 font-medium break-all underline underline-offset-4">
          <Icono nombre="enlace" className="h-4 w-4 shrink-0" />{p.url}
        </a>
      )}
      {entregada && p.note && <p className="mt-2 text-sm whitespace-pre-line">«{p.note}»</p>}

      {p.graded ? (
        p.grade === null && <p className="mt-3 text-sm">Ya está evaluada. Verás el resultado aquí cuando se publique.</p>
      ) : (
        <form ref={formRef} onSubmit={onSubmit} className="mt-3 space-y-3">
          {p.acceptsFiles && (
            <div>
              <input name="files" type="file" multiple accept={acceptAttr(p.allowedExtensions)} className="block w-full text-sm file:border-papel! file:text-papel! hover:file:bg-tinta!" />
              {p.allowedExtensions && <p className="mt-1 text-sm">Formatos admitidos: {showExtensions(p.allowedExtensions)}</p>}
            </div>
          )}
          {p.acceptsLink && (
            <input
              name="url"
              type="url"
              defaultValue={p.url}
              placeholder="Enlace a tu trabajo (https://www.figma.com/…)"
              className="w-full border border-papel/40 bg-tinta-profunda/40 px-3 py-2 text-papel placeholder:text-niebla"
            />
          )}
          <textarea
            name="note"
            rows={2}
            defaultValue={p.note}
            placeholder="Comentario para el profesorado (opcional)"
            className="w-full border border-papel/40 bg-tinta-profunda/40 px-3 py-2 text-papel placeholder:text-niebla"
          />
          {error && <p className="bg-papel px-3 py-2 text-sm text-aviso">{error}</p>}
          <button disabled={busy} className="bg-ocre px-4 py-2 font-medium text-grafito hover:bg-papel disabled:opacity-60">
            {busy ? "Subiendo…" : entregada ? "Actualizar la entrega" : "Entregar"}
          </button>
          {p.status === "sin-entregar" && <p className="text-sm">Aún puedes entregar; quedará marcada como tarde.</p>}
        </form>
      )}
    </div>
  );
}
