"use client";

import { useActionState } from "react";
import { requestLogin, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(requestLogin, { status: "idle" });

  if (state.status === "sent") {
    return <p className="bg-acento-suave p-4">{state.message}</p>;
  }

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Correo de la escuela</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="input mt-1 w-full"
          placeholder="nombre@escuela.es"
        />
      </label>
      {state.status === "error" && <p className="text-sm text-aviso">{state.message}</p>}
      <button disabled={pending} className="btn-primary w-full">
        {pending ? "Enviando…" : "Enviarme el enlace"}
      </button>
    </form>
  );
}
