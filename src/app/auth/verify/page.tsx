import Link from "next/link";
import { Portada } from "@/components/portada";
import { safeNext } from "@/lib/next-path";
import { consumeLogin } from "./actions";

// El enlace del correo abre esta página y el acceso se confirma con un botón (POST),
// para que los antivirus que abren enlaces automáticamente no lo gasten.
export default async function VerifyPage({ searchParams }: PageProps<"/auth/verify">) {
  const { token, error, next } = await searchParams;
  const valid = typeof token === "string" && token.length > 0;

  return (
    <Portada>
      <h2 className="mb-4 text-2xl font-semibold">Ya casi estás</h2>
      {error || !valid ? (
        <>
          <p className="mb-4 text-gris">El enlace no es válido o ha caducado.</p>
          <Link href="/login" className="btn-primary inline-block">Pedir otro enlace</Link>
        </>
      ) : (
        <form action={consumeLogin}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="next" value={safeNext(next)} />
          <button className="btn-primary w-full">Entrar en Aula26</button>
        </form>
      )}
    </Portada>
  );
}
