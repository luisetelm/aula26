import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSubjectAccess } from "@/lib/subject-access";
import { updateSubject } from "@/app/actions";
import { DeleteSubject } from "./delete-subject";

const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;

export default async function AjustesPage({ params, searchParams }: PageProps<"/asignaturas/[id]/ajustes">) {
  const { id } = await params;
  const { user, subject } = await getSubjectAccess(id);
  if (!user.isAdmin) notFound();
  const { guardado } = await searchParams;
  const [lessons, people, submissions] = await Promise.all([
    db.lesson.count({ where: { subjectId: id } }),
    db.enrollment.count({ where: { subjectId: id } }),
    db.submission.count({ where: { assessment: { lesson: { subjectId: id } }, submittedAt: { not: null } } }),
  ]);

  return (
    <div className="space-y-8">
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Datos de la asignatura</h2>
        <form action={updateSubject.bind(null, id)} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-1 flex-col text-sm">
            Nombre
            <input name="name" required defaultValue={subject.name} className="input mt-1" />
          </label>
          <label className="flex flex-col text-sm">
            Curso
            <input name="academicYear" required defaultValue={subject.academicYear} className="input mt-1 w-28" />
          </label>
          <label className="flex flex-col text-sm">
            Grupo
            <input name="group" defaultValue={subject.group} className="input mt-1 w-24" />
          </label>
          <button className="btn-primary">Guardar</button>
        </form>
        {guardado && <p className="text-sm text-acento">Guardado.</p>}
      </section>

      <section className="card space-y-3 border-2 border-aviso">
        <h2 className="text-lg font-semibold text-aviso">Borrar la asignatura</h2>
        <p>
          Se borran para siempre {n(lessons, "sesión", "sesiones")} con materiales y tareas, {n(submissions, "entrega", "entregas")} con
          sus archivos y notas, y la matrícula de {n(people, "persona", "personas")}. Las cuentas del alumnado y del profesorado no se borran: siguen en sus
          otras asignaturas.
        </p>
        <DeleteSubject subjectId={id} name={subject.name} />
      </section>
    </div>
  );
}
