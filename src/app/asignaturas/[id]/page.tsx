import Link from "next/link";
import { getSubjectAccess } from "@/lib/subject-access";
import { getTimeline } from "@/lib/content";
import { dayParts, daysUntil, formatDate, formatDateTime, relativeDay } from "@/lib/time";
import { Markdown } from "@/components/markdown";
import { PublishBadge } from "@/components/publish-badge";
import { Estrella, Icono } from "@/components/icono";
import { Programa, minutosTotales } from "@/components/programa";
import { createLessonAction } from "./sesiones/actions";
import { LessonFields } from "./sesiones/lesson-fields";

type Lesson = Awaited<ReturnType<typeof getTimeline>>[number];
type Material = Lesson["materials"][number];
type Assessment = Lesson["assessments"][number];

const materialHref = (m: Material) => (m.kind === "FILE" && m.file ? `/api/archivos/${m.file.id}` : m.kind === "LINK" ? m.url : null);

// Chip de plazo: ocre cuando apremia, apagado cuando ya pasó.
function Plazo({ dueAt, now, oscuro = false }: { dueAt: Date; now: Date; oscuro?: boolean }) {
  const d = daysUntil(dueAt, now);
  const cerrada = dueAt < now;
  const texto = cerrada ? "Plazo cerrado" : d === 0 ? "Se entrega hoy" : `Se entrega ${relativeDay(dueAt, now)}`;
  const tono = cerrada
    ? oscuro ? "text-niebla" : "text-gris"
    : d <= 3 ? "border-ocre bg-ocre text-grafito" : oscuro ? "text-papel" : "text-grafito";
  return (
    <span className={`badge ${tono}`} title={formatDateTime(dueAt)}>
      <Icono nombre="reloj" className="h-3.5 w-3.5" />{texto}
    </span>
  );
}

function Diapositivas({ m, grande = false }: { m: Material; grande?: boolean }) {
  const href = materialHref(m);
  if (!href) return null;
  return (
    <a
      href={href}
      {...(m.kind === "LINK" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`inline-flex items-center gap-2 bg-ocre font-medium text-grafito hover:bg-papel ${grande ? "px-5 py-3 text-lg" : "px-3 py-1.5 text-sm"}`}
    >
      <Icono nombre="diapositivas" className={grande ? "h-6 w-6" : "h-4 w-4"} />Ver diapositivas
    </a>
  );
}

export default async function SubjectTimeline({ params }: PageProps<"/asignaturas/[id]">) {
  const { id } = await params;
  const { canManage } = await getSubjectAccess(id);
  const lessons = await getTimeline(id, canManage);
  const now = new Date();

  // La sesión protagonista: la de hoy; si no hay, la siguiente; si no, la última.
  const foco =
    lessons.find((l) => daysUntil(l.date, now) === 0) ?? lessons.find((l) => daysUntil(l.date, now) > 0) ?? lessons.at(-1);
  const pendientes = lessons
    .flatMap((l) => l.assessments.map((a) => ({ ...a, lessonId: l.id })))
    .filter((a): a is Assessment & { lessonId: string; dueAt: Date } => !!a.dueAt && a.dueAt >= now)
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());

  return (
    <div className="space-y-10">
      {foco && <Resumen lesson={foco} pendientes={pendientes} now={now} canManage={canManage} />}

      {lessons.length === 0 && (
        <div className="card text-gris">
          {canManage ? "Todavía no hay sesiones. Crea la primera abajo." : "Aún no hay sesiones publicadas en esta asignatura."}
        </div>
      )}

      <ol className="space-y-6">
        {lessons.map((l) => (
          <Sesion key={l.id} lesson={l} subjectId={id} canManage={canManage} now={now} />
        ))}
      </ol>

      {canManage && (
        <section className="card">
          <h2 className="mb-4 text-xl font-semibold">Nueva sesión</h2>
          <form action={createLessonAction.bind(null, id)} className="space-y-4">
            <LessonFields />
            <button className="btn-primary">Crear sesión</button>
          </form>
        </section>
      )}
    </div>
  );
}

function Resumen({
  lesson,
  pendientes,
  now,
  canManage,
}: {
  lesson: Lesson;
  pendientes: (Assessment & { lessonId: string; dueAt: Date })[];
  now: Date;
  canManage: boolean;
}) {
  const d = daysUntil(lesson.date, now);
  const etiqueta = d === 0 ? "Hoy en clase" : d > 0 ? `Próxima sesión · ${relativeDay(lesson.date, now)}` : "Última sesión";
  const slides = lesson.materials.find((m) => m.isSlides);
  const minutos = minutosTotales(lesson.plan);
  return (
    <section className="relative grid overflow-hidden bg-tinta text-papel md:grid-cols-[1fr_20rem]">
      <Estrella className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 text-niebla/60 md:hidden" />
      <div className="relative p-6 md:p-8">
        <p className="etiqueta text-ocre!">{etiqueta}</p>
        <a href={`#sesion-${lesson.id}`} className="mt-2 block text-3xl font-semibold tracking-tight hover:underline md:text-4xl">
          {lesson.title}
        </a>
        <p className="mt-2 text-niebla first-letter:uppercase">
          {formatDate(lesson.date)}
          {minutos > 0 && ` · ${minutos} min de clase`}
        </p>
        {slides && <div className="mt-6"><Diapositivas m={slides} grande /></div>}
      </div>
      <div className="relative border-t border-niebla/30 p-6 md:border-t-0 md:border-l md:p-8">
        <p className="etiqueta text-ocre!">{canManage ? "Tareas abiertas" : "Tareas pendientes"}</p>
        <p className="mt-1 font-mono text-6xl font-medium">{pendientes.length}</p>
        {pendientes.length === 0 ? (
          <p className="mt-2 text-niebla">{canManage ? "Ninguna con plazo abierto." : "Nada pendiente. Bien."}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {pendientes.slice(0, 3).map((a) => (
              <li key={a.id}>
                <a href={`#tarea-${a.id}`} className="font-medium hover:underline">{a.title}</a>
                <div className="mt-1"><Plazo dueAt={a.dueAt} now={now} oscuro /></div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Sesion({ lesson: l, subjectId, canManage, now }: { lesson: Lesson; subjectId: string; canManage: boolean; now: Date }) {
  const d = daysUntil(l.date, now);
  const hoy = d === 0;
  const pasada = d < 0;
  const { day, month, weekday } = dayParts(l.date);
  const slides = l.materials.filter((m) => m.isSlides);
  const material = l.materials.filter((m) => !m.isSlides);
  const minutos = minutosTotales(l.plan);

  return (
    <li id={`sesion-${l.id}`} className="scroll-mt-6 sm:grid sm:grid-cols-[5.5rem_1fr] sm:gap-6">
      <div className={`mb-2 flex items-baseline gap-2 sm:mb-0 sm:block sm:pt-5 sm:text-center ${pasada ? "text-gris" : hoy ? "text-acento" : "text-grafito"}`}>
        <div className="font-mono text-3xl leading-none font-medium sm:text-5xl">{day}</div>
        <div className="etiqueta text-current! sm:mt-1">{month}</div>
        <div className="text-xs text-gris">{weekday}</div>
      </div>

      <article className={`card space-y-5 max-sm:p-4 ${hoy ? "ring-2 ring-acento" : ""} ${pasada ? "bg-papel-hondo/60" : ""}`}>
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {hoy && <span className="badge border-acento bg-acento text-papel">Hoy</span>}
              {pasada && <span className="badge text-gris"><Icono nombre="check" className="h-3.5 w-3.5" />Hecha</span>}
              {canManage && <PublishBadge publishAt={l.publishAt} />}
            </div>
            <h2 className={`mt-2 text-2xl font-semibold tracking-tight ${pasada ? "text-gris" : ""}`}>{l.title}</h2>
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gris">
              {minutos > 0 && <span className="inline-flex items-center gap-1"><Icono nombre="reloj" className="h-4 w-4" />{minutos} min</span>}
              {material.length > 0 && <span className="inline-flex items-center gap-1"><Icono nombre="lectura" className="h-4 w-4" />{material.length} {material.length === 1 ? "recurso" : "recursos"}</span>}
              {l.assessments.length > 0 && <span className="inline-flex items-center gap-1"><Icono nombre="entrega" className="h-4 w-4" />{l.assessments.length} {l.assessments.length === 1 ? "tarea" : "tareas"}</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {slides.map((m) => <Diapositivas key={m.id} m={m} />)}
            {canManage && <Link href={`/asignaturas/${subjectId}/sesiones/${l.id}`} className="enlace text-sm">Editar</Link>}
          </div>
        </header>

        {l.plan.trim() && (
          <section>
            <h3 className="etiqueta mb-3">Qué haremos</h3>
            <Programa plan={l.plan} />
          </section>
        )}

        {material.length > 0 && (
          <section>
            <h3 className="etiqueta mb-3">Material</h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {material.map((m) => <MaterialItem key={m.id} m={m} canManage={canManage} />)}
            </ul>
          </section>
        )}

        {l.assessments.map((a) => <Tarea key={a.id} a={a} canManage={canManage} now={now} />)}
      </article>
    </li>
  );
}

function MaterialItem({ m, canManage }: { m: Material; canManage: boolean }) {
  const href = materialHref(m);
  const icono = m.kind === "LINK" ? "enlace" : "lectura";
  const cabecera = (
    <span className="flex items-center gap-3">
      <span className="flex h-9 w-9 flex-none items-center justify-center bg-acento-suave text-acento"><Icono nombre={icono} /></span>
      <span className="min-w-0 font-medium">{m.title}</span>
    </span>
  );
  return (
    <li className={`bg-papel p-3 ${m.kind === "TEXT" ? "sm:col-span-2" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {href ? (
          <a href={href} {...(m.kind === "LINK" ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="text-acento hover:underline">
            {cabecera}
          </a>
        ) : (
          cabecera
        )}
        {canManage && m.publishAt && <PublishBadge publishAt={m.publishAt} />}
      </div>
      {m.kind === "TEXT" && <div className="mt-2 pl-12"><Markdown>{m.body}</Markdown></div>}
    </li>
  );
}

// La tarea usa el fondo «acento» de la diapositiva Actividad.
function Tarea({ a, canManage, now }: { a: Assessment; canManage: boolean; now: Date }) {
  return (
    <section id={`tarea-${a.id}`} className="sobre-oscuro scroll-mt-6 bg-acento p-5 text-papel">
      <div className="flex flex-wrap items-center gap-2">
        <span className="etiqueta inline-flex items-center gap-1 text-papel!"><Icono nombre="entrega" className="h-4 w-4" />Tarea</span>
        {a.dueAt && <Plazo dueAt={a.dueAt} now={now} oscuro />}
        {a.weight > 0 && <span className="badge text-papel">{a.weight}% de la nota</span>}
        {canManage && a.publishAt && <PublishBadge publishAt={a.publishAt} oscuro />}
      </div>
      <h3 className="mt-2 text-xl font-semibold">{a.title}</h3>
      {a.dueAt && <p className="text-sm text-papel">Hasta el {formatDateTime(a.dueAt)}</p>}
      <div className="mt-3"><Markdown>{a.instructions}</Markdown></div>
      {a.file && (
        <a href={`/api/archivos/${a.file.id}`} className="mt-3 inline-flex items-center gap-2 font-medium text-papel underline underline-offset-4">
          <Icono nombre="lectura" className="h-4 w-4" />{a.file.name}
        </a>
      )}
      {a.acceptsSubmissions && <p className="mt-3 text-sm text-papel">Podrás subir tu entrega aquí muy pronto.</p>}
    </section>
  );
}
