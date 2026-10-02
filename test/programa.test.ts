import { describe, expect, it } from "vitest";
import { minutosTotales, parsePrograma } from "@/lib/programa";

describe("programa", () => {
  it("convierte la lista en pasos con su duración", () => {
    const plan = "Intro libre\n\n- Repaso (10 min)\n- **Teoría**: entrevistas (25 minutos)\n- Práctica\n\nCierre";
    expect(parsePrograma(plan)).toEqual([
      { tipo: "texto", md: "Intro libre\n" },
      { tipo: "pasos", pasos: [
        { texto: "Repaso", minutos: 10 },
        { texto: "**Teoría**: entrevistas", minutos: 25 },
        { texto: "Práctica", minutos: null },
      ] },
      { tipo: "texto", md: "Cierre" },
    ]);
    expect(minutosTotales(plan)).toBe(35);
  });

  it("acepta listas numeradas y no confunde paréntesis normales", () => {
    expect(parsePrograma("1. Ver vídeo (opcional)")).toEqual([{ tipo: "pasos", pasos: [{ texto: "Ver vídeo (opcional)", minutos: null }] }]);
  });
});
