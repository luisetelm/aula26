import type { ReactNode } from "react";
import { Icono } from "./icono";

// Bloque que se pliega y despliega sin JavaScript (<details>). `recordar` es la clave con la que
// el navegador guarda si la persona lo dejó plegado (ver PlegarSesiones).
export function Plegable({
  recordar,
  abierto = true,
  titulo,
  children,
  className = "",
  tituloClassName = "",
}: {
  recordar: string;
  abierto?: boolean;
  titulo: ReactNode;
  children: ReactNode;
  className?: string;
  tituloClassName?: string;
}) {
  return (
    <details open={abierto} data-recordar={recordar} data-abierto={abierto ? "1" : "0"} className={`group/plegable ${className}`}>
      <summary className={`flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden ${tituloClassName}`}>
        <Icono nombre="desplegar" className="h-4 w-4 flex-none transition-transform group-not-open/plegable:-rotate-90" />
        {titulo}
      </summary>
      {children}
    </details>
  );
}
