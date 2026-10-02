"use client";

import { useActionState } from "react";
import { discardProposalAction, gradeAction } from "../actions";

export function NotaForm({
  subjectId,
  assessmentId,
  studentId,
  grade,
  feedback,
  proposal,
  completion = false,
  submitted = false,
}: {
  subjectId: string;
  assessmentId: string;
  studentId: string;
  grade: number | null;
  feedback: string;
  proposal: { grade: number | null; feedback: string } | null;
  completion?: boolean; // entregada / no entregada
  submitted?: boolean;
}) {
  const [state, action, pending] = useActionState(gradeAction.bind(null, subjectId, assessmentId, studentId), {});
  const shown = proposal ?? { grade, feedback };
  return (
    <div className="space-y-3">
      {proposal && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-l-4 border-acento bg-acento-suave px-3 py-2 text-sm">
          <span>
            <strong className="font-semibold">Propuesta de Claude.</strong> Revísala, cámbiala si quieres y pulsa Guardar para aceptarla.
            {grade !== null && ` Ahora: ${completion ? (grade > 0 ? "entregada" : "no entregada") : String(grade).replace(".", ",")}.`}
          </span>
          <button
            type="button"
            onClick={() => discardProposalAction(subjectId, assessmentId, studentId)}
            className="font-medium text-acento hover:text-tinta"
          >
            Descartar
          </button>
        </div>
      )}
      <form action={action} className={`grid gap-3 sm:items-start ${completion ? "sm:grid-cols-[9rem_1fr_auto]" : "sm:grid-cols-[7rem_1fr_auto]"}`}>
        {completion ? (
          <fieldset className="flex flex-col gap-1 text-sm">
            <legend>Valoración</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="grade" value="1" defaultChecked={(shown.grade ?? (submitted ? 1 : 0)) > 0} /> Entregada
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="grade" value="0" defaultChecked={(shown.grade ?? (submitted ? 1 : 0)) === 0} /> No entregada
            </label>
          </fieldset>
        ) : (
          <label className="flex flex-col text-sm">
            Nota (0–10)
            <input
              name="grade"
              inputMode="decimal"
              defaultValue={shown.grade === null ? "" : String(shown.grade).replace(".", ",")}
              placeholder="—"
              className="input mt-1 font-mono text-xl"
            />
          </label>
        )}
        <label className="flex flex-col text-sm">
          Comentario
          <textarea name="feedback" rows={2} defaultValue={shown.feedback} className="input mt-1" placeholder="Qué está bien y qué mejorar" />
        </label>
        <div className="flex flex-col gap-1 sm:pt-6">
          <button disabled={pending} className="btn-primary">{pending ? "Guardando…" : "Guardar"}</button>
          {state.ok && !pending && <span className="text-sm text-acento">Guardado</span>}
          {state.error && <span className="text-sm text-aviso">{state.error}</span>}
        </div>
      </form>
    </div>
  );
}
