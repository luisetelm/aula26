"use client";

import { useActionState } from "react";
import { loginWithCode, requestLogin, type CodeState, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(requestLogin, { status: "idle" });

  if (state.status === "sent") return <CodeForm email={state.email ?? ""} message={state.message ?? ""} />;

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

function CodeForm({ email, message }: { email: string; message: string }) {
  const [state, action, pending] = useActionState<CodeState, FormData>(loginWithCode, {});
  return (
    <div className="space-y-4">
      <p className="bg-acento-suave p-4">{message}</p>
      <form action={action} className="space-y-4">
        <input type="hidden" name="email" value={email} />
        <label className="block">
          <span className="text-sm font-medium">Código del correo</span>
          <input
            name="code"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            className="input mt-1 w-full font-mono text-2xl tracking-[0.3em]"
            placeholder="000000"
          />
        </label>
        {state.error && <p className="text-sm text-aviso">{state.error}</p>}
        <button disabled={pending} className="btn-primary w-full">{pending ? "Comprobando…" : "Entrar"}</button>
      </form>
    </div>
  );
}
