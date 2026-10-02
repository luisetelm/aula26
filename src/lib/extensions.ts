// Extensiones admitidas en una entrega. Se guardan como "pdf,fig"; vacío = cualquiera.

export function parseExtensions(value: string) {
  const list = value
    .toLowerCase()
    .split(/[\s,;]+/)
    .map((e) => e.replace(/^\*?\./, "").trim())
    .filter((e) => /^[a-z0-9]{1,10}$/.test(e));
  return [...new Set(list)];
}

export const normalizeExtensions = (value: string) => parseExtensions(value).join(",");

export function extensionAllowed(fileName: string, allowed: string) {
  const list = parseExtensions(allowed);
  if (list.length === 0) return true;
  const ext = /\.([^.]+)$/.exec(fileName.toLowerCase())?.[1];
  return !!ext && list.includes(ext);
}

// ".pdf, .fig" para mostrar; ".pdf,.fig" para el atributo accept del input.
export const showExtensions = (allowed: string) => parseExtensions(allowed).map((e) => `.${e}`).join(", ");
export const acceptAttr = (allowed: string) => parseExtensions(allowed).map((e) => `.${e}`).join(",") || undefined;
