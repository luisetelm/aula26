"use client";

import { useActionState, useState } from "react";
import { claimSeatAction, type ClaimState } from "./actions";

export function ElegirNombre({ code, seats }: { code: string; seats: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<ClaimState, FormData>(claimSeatAction.bind(null, code), {});
  const [filtro, setFiltro] = useState("");
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const visibles = seats.filter((s) => norm(s.name).includes(norm(filtro)));
  return (
    <form action={action} className="space-y-4">
      {seats.length > 8 && (
        <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Busca tu nombre" className="input w-full" />
      )}
      <ul className="max-h-80 space-y-1 overflow-auto">
        {visibles.map((s) => (
          <li key={s.id}>
            <label className="flex cursor-pointer items-center gap-3 border border-linea bg-papel px-3 py-2 has-checked:border-acento has-checked:bg-acento-suave">
              <input type="radio" name="seat" value={s.id} required />
              {s.name}
            </label>
          </li>
        ))}
      </ul>
      {state.error && <p className="text-sm text-aviso">{state.error}</p>}
      <button disabled={pending} className="btn-primary w-full">{pending ? "Guardando…" : "Soy yo, entrar"}</button>
    </form>
  );
}
