// Pictogramas de línea del sistema Aula (retícula de 48, trazo 3, puntas rectas).
// Toman el color del texto al que acompañan; nunca sustituyen a la palabra.
const trazos = {
  entrega: <path d="M8 30v10h32V30M24 6v22M16 20l8 8 8-8" />,
  enlace: <path d="M20 28l8-8M22 14l4-4a8.5 8.5 0 0 1 12 12l-4 4M26 34l-4 4a8.5 8.5 0 0 1-12-12l4-4" />,
  lectura: <path d="M24 13v27M24 13c-5-3-12-4-18-2v27c6-2 13-1 18 2M24 13c5-3 12-4 18-2v27c-6-2-13-1-18 2" />,
  reloj: (
    <>
      <circle cx="24" cy="24" r="18" />
      <path d="M24 14v10h8" />
    </>
  ),
  flecha: <path d="M6 24h34M30 14l10 10-10 10" />,
};

export type NombreIcono = keyof typeof trazos;

export function Icono({ nombre, className = "h-5 w-5" }: { nombre: NombreIcono; className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      className={`inline-block flex-none ${className}`}
    >
      {trazos[nombre]}
    </svg>
  );
}

// Estrella de 8 radios: motivo de portada (fondo tinta, trazo niebla).
export function Estrella({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 800 800" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true" className={className}>
      <line x1="400" y1="0" x2="400" y2="800" />
      <line x1="0" y1="400" x2="800" y2="400" />
      <line x1="117" y1="117" x2="683" y2="683" />
      <line x1="683" y1="117" x2="117" y2="683" />
    </svg>
  );
}
