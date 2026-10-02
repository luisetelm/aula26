import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Portada } from "@/components/portada";
import { checkAuthorizeRequest, canUseConnector } from "./request";
import { decide } from "./actions";

// Pantalla de permiso: Claude pide actuar en Aula26 en tu nombre.
export default async function AuthorizePage({ searchParams }: PageProps<"/oauth/authorize">) {
  const params = await searchParams;
  const req = await checkAuthorizeRequest(params);
  if (!req.ok) {
    return (
      <Portada>
        <h2 className="mb-4 text-2xl font-semibold">Petición no válida</h2>
        <p className="text-gris">Vuelve a Claude y conecta Aula26 otra vez.</p>
      </Portada>
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    const query = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => typeof e[1] === "string"));
    redirect(`/login?next=${encodeURIComponent(`/oauth/authorize?${query}`)}`);
  }

  const allowed = await canUseConnector(user);
  const hidden = ["client_id", "redirect_uri", "response_type", "code_challenge", "code_challenge_method", "state"];

  return (
    <Portada>
      <p className="etiqueta">Conectar con Claude</p>
      <h2 className="mt-1 mb-4 text-2xl font-semibold">{req.client.name || "Claude"} quiere usar Aula26 como tú</h2>
      {allowed ? (
        <>
          <p className="mb-2">Podrá, en tus asignaturas:</p>
          <ul className="mb-4 list-disc space-y-1 pl-5">
            <li>Ver la programación, las tareas y las entregas del alumnado.</li>
            <li>Crear sesiones, materiales y tareas como borrador.</li>
            <li>Proponer notas y comentarios, que tú revisas antes de que cuenten.</li>
          </ul>
          <p className="mb-6 text-sm text-gris">
            No puede publicar, borrar ni poner notas definitivas. Entras como {user.email}. Puedes desconectarlo cuando quieras en{" "}
            <Link href="/claude" className="enlace">Claude en Aula26</Link>.
          </p>
          <form action={decide} className="flex gap-3">
            {hidden.map((k) => (
              <input key={k} type="hidden" name={k} value={typeof params[k] === "string" ? params[k] : ""} />
            ))}
            <button name="decision" value="allow" className="btn-primary flex-1">Permitir</button>
            <button name="decision" value="deny" className="btn-secondary">Cancelar</button>
          </form>
        </>
      ) : (
        <>
          <p className="mb-6 text-gris">El conector de Claude es solo para el profesorado.</p>
          <form action={decide}>
            {hidden.map((k) => (
              <input key={k} type="hidden" name={k} value={typeof params[k] === "string" ? params[k] : ""} />
            ))}
            <button name="decision" value="deny" className="btn-secondary">Volver a Claude</button>
          </form>
        </>
      )}
    </Portada>
  );
}
