import { describe, expect, it } from "vitest";
import { acceptAttr, extensionAllowed, normalizeExtensions, showExtensions } from "@/lib/extensions";

describe("extensiones admitidas", () => {
  it("normaliza lo que escribe el profesor", () => {
    expect(normalizeExtensions(" .PDF, fig;*.png  pdf")).toBe("pdf,fig,png");
    expect(normalizeExtensions("")).toBe("");
  });
  it("comprueba el archivo", () => {
    expect(extensionAllowed("Trabajo.FIG", "pdf,fig")).toBe(true);
    expect(extensionAllowed("trabajo.pdf.exe", "pdf,fig")).toBe(false);
    expect(extensionAllowed("sin-extension", "pdf")).toBe(false);
    expect(extensionAllowed("loquesea.zip", "")).toBe(true);
  });
  it("lo muestra", () => {
    expect(showExtensions("pdf,fig")).toBe(".pdf, .fig");
    expect(acceptAttr("pdf,fig")).toBe(".pdf,.fig");
    expect(acceptAttr("")).toBeUndefined();
  });
});
