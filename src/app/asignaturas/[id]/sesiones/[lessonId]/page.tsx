import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSubjectAccess } from "@/lib/subject-access";
import { formatDateTime } from "@/lib/time";
import { PublishBadge } from "@/components/publish-badge";
import { deleteAssessmentAction, deleteLessonAction, deleteMaterialAction, updateLessonAction } from "../actions";
import { LessonFields } from "../lesson-fields";
import { AssessmentFormView, MaterialFormView } from "./item-forms";

const KIND = { FILE: "Archivo", LINK: "Enlace", TEXT: "Texto" } as const;

export default async function LessonEditor({ params }: PageProps<"/asignaturas/[id]/sesiones/[lessonId]">) {
  const { id, lessonId } = await params;
  const { canManage } = await getSubjectAccess(id);
  if (!canManage) notFound();
  const lesson = await db.lesson.findFirst({
    where: { id: lessonId, subjectId: id },
    include: {
      materials: { orderBy: { position: "asc" }, include: { file: true } },
      assessments: { orderBy: { createdAt: "asc" }, include: { file: true } },
    },
  });
  if (!lesson) notFound();

  return (
    <div className="space-y-6">
      <Link href={`/asignaturas/${id}#sesion-${lesson.id}`} className="text-sm text-slate-500 hover:text-slate-800">← Volver al timeline</Link>

      <section className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sesión</h2>
          <PublishBadge publishAt={lesson.publishAt} />
        </div>
        <form action={updateLessonAction.bind(null, id, lesson.id)} className="space-y-4">
          <LessonFields lesson={lesson} />
          <div className="flex gap-3">
            <button className="btn-primary">Guardar</button>
          </div>
        </form>
        <form action={deleteLessonAction.bind(null, id, lesson.id)} className="mt-4 border-t border-slate-100 pt-4">
          <button className="text-sm text-red-700 hover:underline">Borrar la sesión con todo su material y pruebas</button>
        </form>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Material</h2>
        {lesson.materials.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {lesson.materials.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  <span className="text-slate-500">{KIND[m.kind]} · </span>{m.title}
                  {m.file && <span className="text-slate-500"> ({Math.ceil(m.file.size / 1024)} KB)</span>}
                  {m.publishAt && <span className="ml-2"><PublishBadge publishAt={m.publishAt} /></span>}
                </span>
                <form action={deleteMaterialAction.bind(null, id, m.id)}>
                  <button className="text-red-700 hover:underline">Quitar</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <MaterialFormView subjectId={id} lessonId={lesson.id} />
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Pruebas</h2>
        {lesson.assessments.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {lesson.assessments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  {a.title}
                  <span className="text-slate-500">
                    {a.weight > 0 && ` · ${a.weight}%`}
                    {a.dueAt && ` · hasta ${formatDateTime(a.dueAt)}`}
                    {a.acceptsSubmissions && " · con entrega"}
                  </span>
                  {a.publishAt && <span className="ml-2"><PublishBadge publishAt={a.publishAt} /></span>}
                </span>
                <form action={deleteAssessmentAction.bind(null, id, a.id)}>
                  <button className="text-red-700 hover:underline">Quitar</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <AssessmentFormView subjectId={id} lessonId={lesson.id} />
      </section>
    </div>
  );
}
