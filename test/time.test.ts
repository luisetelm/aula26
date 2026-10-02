import { describe, expect, it } from "vitest";
import { daysUntil, parseLocal, relativeDay, toLocalInput } from "@/lib/time";

describe("time", () => {
  it("interpreta la hora en Madrid en invierno y en verano", () => {
    expect(parseLocal("2026-01-15T09:30", "Europe/Madrid")?.toISOString()).toBe("2026-01-15T08:30:00.000Z");
    expect(parseLocal("2026-07-15T09:30", "Europe/Madrid")?.toISOString()).toBe("2026-07-15T07:30:00.000Z");
  });

  it("acepta solo fecha y rechaza basura", () => {
    expect(parseLocal("2026-10-06", "Europe/Madrid")?.toISOString()).toBe("2026-10-05T22:00:00.000Z");
    expect(parseLocal("mañana")).toBeNull();
  });

  it("ida y vuelta con el input datetime-local", () => {
    const d = parseLocal("2026-03-29T03:15", "Europe/Madrid")!; // día del cambio de hora
    expect(toLocalInput(d, "Europe/Madrid")).toBe("2026-03-29T03:15");
    expect(toLocalInput(parseLocal("2026-11-02T18:00", "Europe/Madrid"), "Europe/Madrid")).toBe("2026-11-02T18:00");
  });

  it("cuenta días de calendario en Madrid, no horas", () => {
    const now = parseLocal("2026-10-01T23:30", "Europe/Madrid")!;
    expect(daysUntil(parseLocal("2026-10-02T00:10", "Europe/Madrid")!, now, "Europe/Madrid")).toBe(1);
    expect(daysUntil(parseLocal("2026-10-01T08:00", "Europe/Madrid")!, now, "Europe/Madrid")).toBe(0);
    expect(relativeDay(parseLocal("2026-10-04T10:00", "Europe/Madrid")!, now, "Europe/Madrid")).toBe("en 3 días");
    expect(relativeDay(parseLocal("2026-09-30T10:00", "Europe/Madrid")!, now, "Europe/Madrid")).toBe("ayer");
  });
});
