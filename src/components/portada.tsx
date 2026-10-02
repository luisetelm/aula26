import { Estrella } from "./icono";

// Pantalla de entrada con la «Portada» de Aula: franja tinta con la estrella y el formulario sobre papel.
export function Portada({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen grid-rows-[auto_1fr] md:grid-cols-2 md:grid-rows-none">
      <section className="relative overflow-hidden bg-tinta px-8 py-12 text-papel md:px-16 md:py-24">
        <Estrella className="absolute -top-16 -right-16 h-48 w-48 text-niebla md:-top-32 md:-right-32 md:h-80 md:w-80" />
        <p className="etiqueta text-ocre!">Aula virtual</p>
        <h1 className="mt-2 text-5xl font-semibold tracking-tight md:text-7xl">Aula26</h1>
        <p className="mt-4 max-w-sm text-lg text-niebla">Sesiones, material y entregas de tus asignaturas en un solo sitio.</p>
      </section>
      <section className="flex items-start px-8 py-12 md:items-center md:px-16">
        <div className="w-full max-w-sm">{children}</div>
      </section>
    </main>
  );
}
