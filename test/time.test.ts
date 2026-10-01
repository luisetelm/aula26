import { describe, expect, it } from "vitest";
import { parseLocal, toLocalInput } from "@/lib/time";

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
});
