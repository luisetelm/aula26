import { describe, expect, it } from "vitest";
import { submissionStatus } from "@/lib/submissions";

describe("estado de la entrega", () => {
  const due = new Date("2026-10-10T21:59:00Z");
  it("distingue a tiempo, tarde, pendiente y no entregada", () => {
    expect(submissionStatus(due, new Date("2026-10-09T10:00:00Z"))).toBe("entregada");
    expect(submissionStatus(due, new Date("2026-10-11T10:00:00Z"))).toBe("tarde");
    expect(submissionStatus(due, null, new Date("2026-10-05T10:00:00Z"))).toBe("pendiente");
    expect(submissionStatus(due, null, new Date("2026-10-12T10:00:00Z"))).toBe("sin-entregar");
    expect(submissionStatus(null, null)).toBe("pendiente");
  });
});
