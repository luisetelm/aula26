import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Icono } from "@/components/icono";
import { createSubject } from "./actions";

function currentAcademicYear() {
  const d = new Date();
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
}

export default async function Home() {
  const user = await requireUser();
  const subjects = await db.subject.findMany({
    where: user.isAdmin ? {} : { enrollments: { some: { userId: user.id } } },
    include: {
      enrollments: { where: { userId: user.id }, select: { role: true } },
      _count: { select: { enrollments: { where: { role: "STUDENT" } } } },
    },
    orderBy: [{ academicYear: "desc" }, { name: "asc" }],
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-4xl font-semibold tracking-tight">Mis asignaturas</h1>
      {subjects.length === 0 ? (
        <p className="text-gris">
          {user.isAdmin ? "Aún no has creado ninguna asignatura." : "Todavía no tienes ninguna asignatura."}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {subjects.map((s) => (
            <li key={s.id}>
              <Link href={`/asignaturas/${s.id}`} className="card block transition-colors hover:bg-piedra">
                <div className="etiqueta">{s.academicYear}{s.group && ` · Grupo ${s.group}`}</div>
                <div className="mt-1 text-xl font-semibold">{s.name}</div>
                <div className="text-sm text-gris">
                  Alumnado: {s._count.enrollments}
                  {s.enrollments[0]?.role === "TEACHER" && " · Profesor"}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {(user.isAdmin || subjects.some((s) => s.enrollments[0]?.role === "TEACHER")) && (
        <Link href="/claude" className="card mt-10 flex items-center justify-between gap-4 transition-colors hover:bg-piedra">
          <span>
            <span className="etiqueta">Conector</span>
            <span className="mt-1 block text-lg font-semibold">Claude en Aula26</span>
            <span className="block text-sm text-gris">Programa sesiones y prepara correcciones desde Claude.</span>
          </span>
          <Icono nombre="flecha" className="h-6 w-6 shrink-0 text-acento" />
        </Link>
      )}

      {user.isAdmin && (
        <section className="card mt-10">
          <h2 className="mb-4 text-lg font-semibold">Nueva asignatura</h2>
          <form action={createSubject} className="flex flex-wrap items-end gap-3">
            <label className="flex flex-1 flex-col text-sm">
              Nombre
              <input name="name" required className="input mt-1" placeholder="Diseño de Interfaces" />
            </label>
            <label className="flex flex-col text-sm">
              Curso
              <input name="academicYear" required defaultValue={currentAcademicYear()} className="input mt-1 w-28" />
            </label>
            <label className="flex flex-col text-sm">
              Grupo
              <input name="group" className="input mt-1 w-24" placeholder="A" />
            </label>
            <button className="btn-primary">Crear</button>
          </form>
        </section>
      )}
    </main>
  );
}
