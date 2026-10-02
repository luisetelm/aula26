import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canUseConnector, listConnections, mcpUrl } from "@/lib/oauth";
import { formatDate } from "@/lib/time";
import { disconnect } from "./actions";

export default async function ClaudePage() {
  const user = await requireUser();
  if (!(await canUseConnector(user))) notFound();
  const connections = await listConnections(user.id);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8">
      <div>
        <p className="etiqueta">Conector</p>
        <h1 className="mt-1 text-4xl font-semibold tracking-tight">Claude en Aula26</h1>
        <p className="mt-2 text-gris">
          Conecta Aula26 a tu Claude para programar sesiones y preparar correcciones desde una conversación. Todo lo que haga
          queda como borrador o como propuesta: tú lo revisas y lo publicas.
        </p>
      </div>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Cómo conectarlo</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>En Claude, abre Configuración y entra en Conectores.</li>
          <li>Pulsa «Añadir conector personalizado», ponle de nombre Aula26 y pega esta dirección:</li>
        </ol>
        <p className="bg-papel px-3 py-2 font-mono text-sm break-all select-all">{mcpUrl()}</p>
        <ol start={3} className="list-decimal space-y-2 pl-5">
          <li>Pulsa Conectar. Se abrirá Aula26: entra con tu correo y pulsa Permitir.</li>
        </ol>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">Qué le puedes pedir</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>«Prepara las sesiones de la semana que viene de Tecnología con este temario.»</li>
          <li>«Crea una tarea para el viernes con una rúbrica de 4 criterios.»</li>
          <li>«Corrige las entregas de la práctica 2 con la rúbrica y propón nota y comentario.»</li>
        </ul>
        <p className="text-sm text-gris">
          Las propuestas de nota aparecen en la página de entregas de cada tarea. No cuentan ni las ve el alumnado hasta que
          las guardas.
        </p>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">Conexiones activas</h2>
        {connections.length === 0 ? (
          <p className="text-gris">Todavía no has conectado Claude.</p>
        ) : (
          <ul className="space-y-2">
            {connections.map((c) => (
              <li key={c.clientId} className="flex flex-wrap items-center justify-between gap-2 bg-papel px-3 py-2">
                <span>
                  <span className="font-medium">{c.name || "Claude"}</span>
                  <span className="text-sm text-gris"> · último uso el {formatDate(c.since)}</span>
                </span>
                <form action={disconnect.bind(null, c.clientId)}>
                  <button className="font-medium text-aviso hover:text-tinta">Desconectar</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
