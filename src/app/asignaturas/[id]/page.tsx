import Link from "next/link";
import { getSubjectAccess } from "@/lib/subject-access";
import { getTimeline } from "@/lib/content";
import { formatDate, formatDateTime, toLocalInput } from "@/lib/time";
import { Markdown } from "@/components/markdown";
import { PublishBadge } from "@/components/publish-badge";
import { createLessonAction } from "./sesiones/actions";
import { LessonFields } from "./sesiones/lesson-fields";

export default async function SubjectTimeline({ params }: PageProps<"/asignaturas/[id]">) {
  const { id } = await params;
  const { canManage } = await getSubjectAccess(id);
  const lessons = await getTimeline(id, canManage);
  const today = toLocalInput(new Date()).slice(0, 10);

  return (
    <div className="space-y-6">
      {lessons.length === 0 && (
        <div className="card text-slate-600">Aún no hay sesiones publicadas en esta asignatura.</div>
      )}

      <ol className="relative space-y-6 border-l-2 border-slate-200 pl-6">
        {lessons.map((l) => {
          const day = toLocalInput(l.date).slice(0, 10);
          return (
            <li key={l.id} id={`sesion-${l.id}`} className="relative">
              <span className={`absolute -left-[33px] top-6 h-4 w-4 rounded-full border-2 border-white ${day === today ? "bg-indigo-600" : day < today ? "bg-slate-400" : "bg-slate-200"}`} />
              <article className="card space-y-4">
                <header className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-slate-500 first-letter:uppercase">
                      {formatDate(l.date)} {day === today && <span className="badge ml-1 bg-indigo-100 text-indigo-800">Hoy</span>}
                    </p>
                    <h2 className="text-lg font-semibold">{l.title}</h2>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-3">
                      <PublishBadge publishAt={l.publishAt} />
                      <Link href={`/asignaturas/${id}/sesiones/${l.id}`} className="text-sm text-indigo-700 hover:underline">Editar</Link>
                    </div>
                  )}
                </header>

                <Markdown>{l.plan}</Markdown>

                {l.materials.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Material</h3>
                    <ul className="space-y-2">
                      {l.materials.map((m) => (
                        <li key={m.id} className="rounded-lg bg-slate-50 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {m.kind === "FILE" && m.file ? (
                              <a href={`/api/archivos/${m.file.id}`} className="font-medium text-indigo-700 hover:underline">📎 {m.title}</a>
                            ) : m.kind === "LINK" && m.url ? (
                              <a href={m.url} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-700 hover:underline">🔗 {m.title}</a>
                            ) : (
                              <span className="font-medium">{m.title}</span>
                            )}
                            {canManage && m.publishAt && <PublishBadge publishAt={m.publishAt} />}
                          </div>
                          {m.kind === "TEXT" && <div className="mt-2"><Markdown>{m.body}</Markdown></div>}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {l.assessments.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Pruebas</h3>
                    <ul className="space-y-2">
                      {l.assessments.map((a) => (
                        <li key={a.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{a.title}</span>
                            {a.weight > 0 && <span className="badge bg-white text-slate-700">{a.weight}% de la nota</span>}
                            {a.dueAt && <span className="badge bg-white text-slate-700">Entrega hasta {formatDateTime(a.dueAt)}</span>}
                            {canManage && a.publishAt && <PublishBadge publishAt={a.publishAt} />}
                          </div>
                          <div className="mt-2"><Markdown>{a.instructions}</Markdown></div>
                          {a.file && (
                            <a href={`/api/archivos/${a.file.id}`} className="mt-2 inline-block text-sm text-indigo-700 hover:underline">📎 {a.file.name}</a>
                          )}
                          {a.acceptsSubmissions && (
                            <p className="mt-2 text-sm text-slate-500">Las entregas se podrán subir aquí muy pronto.</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </article>
            </li>
          );
        })}
      </ol>

      {canManage && (
        <section className="card">
          <h2 className="mb-4 text-lg font-semibold">Nueva sesión</h2>
          <form action={createLessonAction.bind(null, id)} className="space-y-4">
            <LessonFields />
            <button className="btn-primary">Crear sesión</button>
          </form>
        </section>
      )}
    </div>
  );
}
