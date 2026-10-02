"use client";

import { useEffect } from "react";

const CLAVE = "aula26:plegado";
const plegables = () => [...document.querySelectorAll<HTMLDetailsElement>("#sesiones details[data-recordar]")];

function leer(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? "{}");
  } catch {
    return {};
  }
}

function guardar(cambios: Record<string, boolean | null>) {
  try {
    const todo: Record<string, boolean | null> = { ...leer(), ...cambios };
    for (const k in todo) if (todo[k] === null) delete todo[k];
    // Lo justo para no crecer sin límite: las últimas 500 claves.
    const recortado = Object.fromEntries(Object.entries(todo).slice(-500));
    localStorage.setItem(CLAVE, JSON.stringify(recortado));
  } catch {}
}

// Plegar o desplegar todas las sesiones, recordar en este navegador lo que cada persona deja
// plegado o abierto y, al seguir un enlace a una sesión o tarea plegada (#sesion-…, #tarea-…), abrirla.
export function PlegarSesiones({ botones }: { botones: boolean }) {
  useEffect(() => {
    const guardado = leer();
    for (const d of plegables()) {
      const v = guardado[d.dataset.recordar!];
      if (v !== undefined) d.open = v;
    }

    const alCambiar = (e: Event) => {
      const d = e.target;
      // Solo se guarda lo que difiere de cómo viene la página: así el navegador no fija el estado
      // inicial (también lanza «toggle» al pintar un <details> abierto).
      if (d instanceof HTMLDetailsElement && d.dataset.recordar && d.closest("#sesiones")) {
        guardar({ [d.dataset.recordar]: d.open === (d.dataset.abierto === "1") ? null : d.open });
      }
    };
    const abrirAncla = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      const el = id ? document.getElementById(id) : null;
      if (!el) return;
      const cerrados: HTMLDetailsElement[] = [...el.querySelectorAll("details")];
      for (let d = el.closest("details"); d; d = d.parentElement?.closest("details") ?? null) cerrados.push(d);
      const abrir = cerrados.filter((d) => !d.open);
      abrir.forEach((d) => (d.open = true));
      if (abrir.length) requestAnimationFrame(() => el.scrollIntoView());
    };
    document.addEventListener("toggle", alCambiar, true);
    abrirAncla();
    window.addEventListener("hashchange", abrirAncla);
    return () => {
      document.removeEventListener("toggle", alCambiar, true);
      window.removeEventListener("hashchange", abrirAncla);
    };
  }, []);

  const todas = (open: boolean) => {
    const sesiones = plegables().filter((d) => d.dataset.recordar!.startsWith("s-"));
    sesiones.forEach((d) => (d.open = open));
  };

  if (!botones) return null;
  return (
    <div className="flex justify-end gap-4 text-sm">
      <button type="button" className="enlace" onClick={() => todas(true)}>Desplegar todas</button>
      <button type="button" className="enlace" onClick={() => todas(false)}>Plegar todas</button>
    </div>
  );
}
