import { Markdown } from "./markdown";
import { Icono } from "./icono";
import { parsePrograma } from "@/lib/programa";

export { minutosTotales } from "@/lib/programa";

export function Programa({ plan }: { plan: string }) {
  const bloques = parsePrograma(plan);
  if (bloques.length === 0) return null;
  let n = 0;
  return (
    <div className="space-y-3">
      {bloques.map((b, i) =>
        b.tipo === "texto" ? (
          <Markdown key={i}>{b.md}</Markdown>
        ) : (
          <ol key={i} className="space-y-2">
            {b.pasos.map((p, j) => (
              <li key={j} className="flex items-baseline gap-4 border-t border-linea pt-2 first:border-t-0 first:pt-0">
                <span className="w-8 flex-none font-mono text-xl font-medium text-acento">{String(++n).padStart(2, "0")}</span>
                <div className="min-w-0 flex-1 [&_.md]:space-y-0"><Markdown>{p.texto}</Markdown></div>
                {p.minutos !== null && (
                  <span className="flex flex-none items-center gap-1 font-mono text-sm text-gris">
                    <Icono nombre="reloj" className="h-4 w-4" />{p.minutos} min
                  </span>
                )}
              </li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}
