import Link from "next/link";
import { HiddenToggle } from "@/components/hidden-toggle";
import { showExtensions } from "@/lib/extensions";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSubjectAccess } from "@/lib/subject-access";
import { formatDateTime, toLocalInput } from "@/lib/time";
import { PublishBadge } from "@/components/publish-badge";
import { deleteAssessmentAction, deleteLessonAction, deleteMaterialAction, updateLessonAction } from "../actions";
import { LessonFields } from "../lesson-fields";
import { AssessmentFormView, MaterialFormView } from "./item-forms";
import { EditAssessment, EditMaterial } from "./item-edit";

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
      <Link href={`/asignaturas/${id}#sesion-${lesson.id}`} className="text-sm text-gris hover:text-acento">← Volver al timeline</Link>

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
        <form action={deleteLessonAction.bind(null, id, lesson.id)} className="mt-4 border-t border-linea pt-4">
          <button className="text-sm text-aviso hover:underline">Borrar la sesión con todo su material y pruebas</button>
        </form>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Material</h2>
        {lesson.materials.length > 0 && (
          <ul className="divide-y divide-linea">
            {lesson.materials.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm">
                <span>
                  <span className="text-gris">{m.isSlides ? "Diapositivas" : KIND[m.kind]} · </span>{m.title}
                  {m.file && <span className="text-gris"> ({Math.ceil(m.file.size / 1024)} KB)</span>}
                  {m.publishAt && <span className="ml-2"><PublishBadge publishAt={m.publishAt} /></span>}
                </span>
                <span className="flex flex-none items-center gap-3">
                  <HiddenToggle subjectId={id} kind="material" id={m.id} hidden={m.hidden} />
                  <form action={deleteMaterialAction.bind(null, id, m.id)}>
                    <button className="text-aviso hover:underline">Quitar</button>
                  </form>
                </span>
                <EditMaterial
                  subjectId={id}
                  m={{ id: m.id, kind: m.kind, title: m.title, body: m.body, url: m.url, isSlides: m.isSlides, publishAt: toLocalInput(m.publishAt) }}
                />
              </li>
            ))}
          </ul>
        )}
        <MaterialFormView subjectId={id} lessonId={lesson.id} />
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Tareas</h2>
        {lesson.assessments.length > 0 && (
          <ul className="divide-y divide-linea">
            {lesson.assessments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm">
                <span>
                  {a.title}
                  <span className="text-gris">
                    {a.weight > 0 && ` · ${a.weight}%`}
                    {a.dueAt && ` · hasta ${formatDateTime(a.dueAt)}`}
                    {a.gradingMode === "COMPLETION" && " · entregada / no entregada"}
                    {a.acceptsSubmissions && ` · archivos${a.allowedExtensions ? ` (${showExtensions(a.allowedExtensions)})` : ""}`}
                    {a.acceptsLink && " · enlace"}
                  </span>
                  {a.publishAt && <span className="ml-2"><PublishBadge publishAt={a.publishAt} /></span>}
                </span>
                <span className="flex flex-none items-center gap-3">
                  <HiddenToggle subjectId={id} kind="assessment" id={a.id} hidden={a.hidden} />
                  <form action={deleteAssessmentAction.bind(null, id, a.id)}>
                    <button className="text-aviso hover:underline">Quitar</button>
                  </form>
                </span>
                <EditAssessment
                  subjectId={id}
                  a={{
                    id: a.id, title: a.title, instructions: a.instructions, dueAt: toLocalInput(a.dueAt), weight: a.weight, rubric: a.rubric,
                    acceptsSubmissions: a.acceptsSubmissions, acceptsLink: a.acceptsLink, allowedExtensions: a.allowedExtensions,
                    gradingMode: a.gradingMode, publishAt: toLocalInput(a.publishAt),
                  }}
                />
              </li>
            ))}
          </ul>
        )}
        <AssessmentFormView subjectId={id} lessonId={lesson.id} />
      </section>
    </div>
  );
}
