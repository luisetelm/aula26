"use client";

import { useActionState } from "react";
import { deleteSubject, type DeleteState } from "@/app/actions";

export function DeleteSubject({ subjectId, name }: { subjectId: string; name: string }) {
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteSubject.bind(null, subjectId), {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-1 flex-col text-sm">
        Para confirmar, escribe el nombre: <strong className="font-semibold">{name}</strong>
        <input name="confirm" required autoComplete="off" className="input mt-1" />
      </label>
      <button disabled={pending} className="bg-aviso px-4 py-2 font-medium text-papel hover:bg-grafito disabled:opacity-60">
        {pending ? "Borrando…" : "Borrar para siempre"}
      </button>
      {state.error && <p className="basis-full text-sm text-aviso">{state.error}</p>}
    </form>
  );
}
