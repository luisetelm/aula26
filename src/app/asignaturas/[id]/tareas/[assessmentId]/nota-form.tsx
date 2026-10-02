"use client";

import { useActionState } from "react";
import { gradeAction } from "../actions";

export function NotaForm({
  subjectId,
  assessmentId,
  studentId,
  grade,
  feedback,
}: {
  subjectId: string;
  assessmentId: string;
  studentId: string;
  grade: number | null;
  feedback: string;
}) {
  const [state, action, pending] = useActionState(gradeAction.bind(null, subjectId, assessmentId, studentId), {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[7rem_1fr_auto] sm:items-start">
      <label className="flex flex-col text-sm">
        Nota (0–10)
        <input
          name="grade"
          inputMode="decimal"
          defaultValue={grade === null ? "" : String(grade).replace(".", ",")}
          placeholder="—"
          className="input mt-1 font-mono text-xl"
        />
      </label>
      <label className="flex flex-col text-sm">
        Comentario
        <textarea name="feedback" rows={2} defaultValue={feedback} className="input mt-1" placeholder="Qué está bien y qué mejorar" />
      </label>
      <div className="flex flex-col gap-1 sm:pt-6">
        <button disabled={pending} className="btn-primary">{pending ? "Guardando…" : "Guardar"}</button>
        {state.ok && !pending && <span className="text-sm text-acento">Guardado</span>}
        {state.error && <span className="text-sm text-aviso">{state.error}</span>}
      </div>
    </form>
  );
}
