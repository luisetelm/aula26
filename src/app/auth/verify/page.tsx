import Link from "next/link";
import { consumeLogin } from "./actions";

// El enlace del correo abre esta página y el acceso se confirma con un botón (POST),
// para que los antivirus que abren enlaces automáticamente no lo gasten.
export default async function VerifyPage({ searchParams }: PageProps<"/auth/verify">) {
  const { token, error } = await searchParams;
  const valid = typeof token === "string" && token.length > 0;

  return (
    <main className="mx-auto mt-24 w-full max-w-sm px-4">
      <h1 className="mb-4 text-2xl font-semibold">Aula26</h1>
      {error || !valid ? (
        <>
          <p className="mb-4 text-slate-700">El enlace no es válido o ha caducado.</p>
          <Link href="/login" className="btn-primary inline-block">Pedir otro enlace</Link>
        </>
      ) : (
        <form action={consumeLogin}>
          <input type="hidden" name="token" value={token} />
          <button className="btn-primary w-full">Entrar en Aula26</button>
        </form>
      )}
    </main>
  );
}
