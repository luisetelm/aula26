import { describe, expect, it } from "vitest";
import { itemVisible } from "@/lib/content";

describe("visibilidad para el alumnado", () => {
  // Sesión el martes 6 de octubre (Madrid), publicada desde el 1.
  const lesson = { date: new Date("2026-10-05T22:00:00Z"), publishAt: new Date("2026-10-01T08:00:00Z") };
  const lunes = new Date("2026-10-05T20:00:00Z");
  const martes = new Date("2026-10-06T06:00:00Z");

  it("oculta el contenido sin fecha propia hasta el día de la sesión (hora de Madrid)", () => {
    expect(itemVisible({ publishAt: null }, lesson, lunes)).toBe(false);
    expect(itemVisible({ publishAt: null }, lesson, martes)).toBe(true);
  });

  it("respeta la fecha propia de un material, antes o después del día de la sesión", () => {
    expect(itemVisible({ publishAt: new Date("2026-10-03T08:00:00Z") }, lesson, lunes)).toBe(true);
    expect(itemVisible({ publishAt: new Date("2026-10-06T12:00:00Z") }, lesson, martes)).toBe(false);
  });

  it("nada se ve si la sesión es un borrador", () => {
    expect(itemVisible({ publishAt: new Date("2026-10-03T08:00:00Z") }, { ...lesson, publishAt: null }, martes)).toBe(false);
  });
});
