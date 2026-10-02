// Ruta a la que volver después de entrar. Solo rutas internas, para no redirigir fuera.
export function safeNext(value: unknown) {
  const s = typeof value === "string" ? value : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : "/";
}
