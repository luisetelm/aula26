// Programación de una sesión: las listas son pasos y «(10 min)» al final de un paso es su duración.
export type Paso = { texto: string; minutos: number | null };
export type Bloque = { tipo: "pasos"; pasos: Paso[] } | { tipo: "texto"; md: string };

const LISTA = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/;
const DURACION = /\s*[(\[]\s*(\d{1,3})\s*(?:min|mins|minutos|')\s*[)\]]\s*$/i;

export function parsePrograma(plan: string): Bloque[] {
  const bloques: Bloque[] = [];
  for (const linea of plan.split(/\r?\n/)) {
    const m = LISTA.exec(linea);
    const ultimo = bloques.at(-1);
    if (m) {
      const d = DURACION.exec(m[1]);
      const paso = { texto: d ? m[1].slice(0, d.index) : m[1], minutos: d ? Number(d[1]) : null };
      if (ultimo?.tipo === "pasos") ultimo.pasos.push(paso);
      else bloques.push({ tipo: "pasos", pasos: [paso] });
    } else if (ultimo?.tipo === "texto") ultimo.md += `\n${linea}`;
    else if (linea.trim()) bloques.push({ tipo: "texto", md: linea });
  }
  return bloques;
}

export function minutosTotales(plan: string) {
  return parsePrograma(plan).reduce((t, b) => t + (b.tipo === "pasos" ? b.pasos.reduce((s, p) => s + (p.minutos ?? 0), 0) : 0), 0);
}

