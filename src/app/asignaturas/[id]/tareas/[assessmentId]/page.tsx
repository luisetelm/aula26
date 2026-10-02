import Link from "next/link";
import { notFound } from "next/navigation";
import { getSubjectAccess } from "@/lib/subject-access";
import { getSubmissionsOverview, type SubmissionStatus } from "@/lib/submissions";
import { formatDateTime } from "@/lib/time";
import { Markdown } from "@/components/markdown";
import { Icono } from "@/components/icono";
import { publishGradesAction } from "../actions";
import { NotaForm } from "./nota-form";

const ESTADO: Record<SubmissionStatus, { texto: string; clase: string }> = {
  entregada: { texto: "Entregada", clase: "border-acento bg-acento text-papel" },
  tarde: { texto: "Entregada tarde", clase: "border-ocre bg-ocre text-grafito" },
  pendiente: { texto: "Sin entregar", clase: "text-gris" },
  "sin-entregar": { texto: "No entregó", clase: "text-aviso" },
};

const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

export default async function EntregasPage({ params }: PageProps<"/asignaturas/[id]/tareas/[assessmentId]">) {
  const { id, assessmentId } = await params;
  const { user, canManage } = await getSubjectAccess(id);
  if (!canManage) notFound();
  const { assessment: a, rows } = await getSubmissionsOverview(user, assessmentId).catch(() => notFound());
  if (a.lesson.subjectId !== id) notFound();

  const cuenta = (s: SubmissionStatus) => rows.filter((r) => r.status === s).length;
  const corregidas = rows.filter((r) => r.submission?.gradedAt).length;
  const notas = rows.map((r) => r.submission?.grade).filter((g): g is number => g !== null && g !== undefined);
  const media = notas.length ? notas.reduce((t, g) => t + g, 0) / notas.length : null;

  return (
    <div className="space-y-8">
      <Link href={`/asignaturas/${id}#sesion-${a.lessonId}`} className="text-sm text-gris hover:text-acento">← Volver al timeline</Link>

      <section className="sobre-oscuro bg-acento p-6 text-papel md:p-8">
        <p className="etiqueta inline-flex items-center gap-1 text-papel!"><Icono nombre="entrega" className="h-4 w-4" />Tarea · {a.lesson.title}</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">{a.title}</h2>
        <p className="mt-1">
          {a.dueAt ? `Hasta el ${formatDateTime(a.dueAt)}` : "Sin fecha límite"}
          {a.weight > 0 && ` · ${a.weight}% de la nota`}
        </p>
        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
          {[
            ["Entregadas", cuenta("entregada")],
            ["Tarde", cuenta("tarde")],
            ["Sin entregar", cuenta("pendiente") + cuenta("sin-entregar")],
            ["Corregidas", `${corregidas}/${rows.length}`],
            ["Media", media === null ? "—" : media.toLocaleString("es-ES", { maximumFractionDigits: 1 })],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-sm">{k}</dt>
              <dd className="font-mono text-4xl font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="card flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold">{a.gradesPublished ? "Las notas están publicadas" : "Las notas no se ven todavía"}</h3>
          <p className="text-sm text-gris">
            {a.gradesPublished
              ? "Cada alumno ve su nota y tu comentario en la tarea."
              : "Corrige con calma: el alumnado no verá nada hasta que publiques."}
          </p>
        </div>
        <form action={publishGradesAction.bind(null, id, a.id, !a.gradesPublished)}>
          <button className={a.gradesPublished ? "btn-secondary" : "btn-primary"}>
            {a.gradesPublished ? "Ocultar notas" : "Publicar notas"}
          </button>
        </form>
      </section>

      {a.rubric.trim() && (
        <details className="card">
          <summary className="cursor-pointer font-semibold">Rúbrica</summary>
          <div className="mt-3"><Markdown>{a.rubric}</Markdown></div>
        </details>
      )}

      {rows.length === 0 ? (
        <p className="card text-gris">Todavía no hay alumnado en esta asignatura.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map(({ student, submission: s, status }) => {
            const nombre = [student.firstName, student.lastName].filter(Boolean).join(" ") || student.email;
            return (
              <li key={student.id} className="card space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-semibold">{nombre}</p>
                    {nombre !== student.email && <p className="text-sm text-gris">{student.email}</p>}
                  </div>
                  <span className={`badge ${ESTADO[status].clase}`}>
                    {ESTADO[status].texto}
                    {s?.submittedAt && ` · ${formatDateTime(s.submittedAt)}`}
                  </span>
                </div>
                {s && (s.files.length > 0 || s.note) && (
                  <div className="space-y-2 bg-papel p-3">
                    {s.files.map((f) => (
                      <a key={f.id} href={`/api/archivos/${f.id}`} className="enlace flex items-center gap-2">
                        <Icono nombre="lectura" className="h-4 w-4" />{f.name}
                        <span className="text-sm font-normal text-gris">{kb(f.size)}</span>
                      </a>
                    ))}
                    {s.note && <p className="text-sm whitespace-pre-line text-gris">«{s.note}»</p>}
                  </div>
                )}
                <NotaForm
                  subjectId={id}
                  assessmentId={a.id}
                  studentId={student.id}
                  grade={s?.grade ?? null}
                  feedback={s?.feedback ?? ""}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
