import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import JSZip from "jszip";
import { z } from "zod";
import type { User } from "@prisma/client";
import { db } from "./db";
import { canManageSubject } from "./auth";
import {
  Forbidden, addAssessment, addMaterial, createLesson, deleteAssessment, deleteLesson, deleteMaterial, fileForDownload, getTimeline,
  createSubject, isPublished, startUpload, storeFile, updateAssessment, updateLesson, updateMaterial, updateSubject,
} from "./content";
import { appUrl } from "./oauth";
import { COMPLETION_DONE, discardProposal, getSubmissionsOverview, gradeSubmission, proposeGrade, setGradesPublished } from "./submissions";
import { enrollPeople, setRole, unenroll } from "./people";
import { addSeats, disableJoin, ensureJoinCode, newJoinCode, removeSeat, setEmailDomain } from "./seats";
import { readObject } from "./storage";
import { readFig } from "./fig";
import { parseLocal, toLocalInput } from "./time";

// Servidor MCP de Aula26: lo que Claude puede hacer en nombre de un profesor.
// Reutiliza content.ts, submissions.ts, people.ts y seats.ts, que comprueban los permisos. El
// profesor puede llevar Aula26 entero desde Claude; por defecto las sesiones nuevas nacen en
// borrador y las notas son propuestas, y Claude no borra tareas o sesiones con entregas.

const INSTRUCTIONS = `Aula26 es el aula virtual del profesor. El alumnado es universitario (3º y 4º de grado): usa un registro académico y profesional, nunca infantil. Escribe en español, con tuteo y lenguaje inclusivo ("alumnado", "profesorado").
- Las fechas van en hora de Madrid con el formato "2026-10-06T09:30".
- El profesor puede pedirte cualquier cosa de Aula26: programar sesiones, materiales y tareas, publicarlas, evaluar, publicar notas y gestionar personas.
- Las sesiones que crees quedan en borrador. Publícalas con publicar_sesion solo cuando el profesor te lo pida.
- Puedes añadir, editar y borrar materiales y tareas, y editar o borrar sesiones, también si ya están publicadas. En una sesión publicada los cambios los ve el alumnado (desde el día de la sesión), así que hazlos solo cuando el profesor te lo pida y dile qué has cambiado.
- Borrar no se puede deshacer: antes de borrar, confirma con el profesor qué vas a borrar si no lo ha nombrado él. No se pueden borrar tareas ni sesiones con entregas del alumnado; eso lo hace el profesor desde Aula26.
- Para editar un texto largo, léelo entero con ver_material y manda el texto completo: editar_material sustituye el texto entero.
- El programa de una sesión es Markdown; cada paso en una línea que empiece por "- " y, si quieres, con la duración al final: "- Repaso de la sesión anterior (10 min)".
- Para evaluar: ver_entregas, leer_archivo de cada archivo y proponer_nota. El comentario va dirigido al estudiante: directo, concreto y argumentado con los criterios de la rúbrica, como en una revisión profesional. El profesor revisa cada propuesta antes de que cuente. Pon notas definitivas (poner_nota, aceptar_propuestas) o publícalas (publicar_notas) solo si el profesor te lo pide expresamente.
- Toda tarea que crees lleva rúbrica (es obligatoria): criterios observables y medibles, con su peso y qué distingue un trabajo excelente, suficiente e insuficiente. En las de entregada / no entregada, la lista de lo que la entrega debe cumplir. Si una tarea existente no tiene rúbrica, propónsela al profesor y añádela con editar_tarea. Evalúa siempre con la rúbrica de la tarea.
- Hay dos tipos de tarea: "nota" (de 0 a 10) y "entregada / no entregada" (tareas de clase de la PAC). En estas últimas, propón entregada si la entrega cumple lo pedido y no entregada si falta o no cumple, explicando por qué.
- Para subir un archivo (diapositivas, enunciado en PDF, plantilla…):
  · Si lo generas tú y es de texto (Markdown, HTML, CSV…), usa subir_archivo con el texto.
  · Si es pequeño (menos de 100 KB), puedes usar subir_archivo con el contenido en base64.
  · Si es un archivo que te ha adjuntado el profesor o es grande, y tienes un entorno para ejecutar código con internet, usa preparar_subida, ejecuta el comando curl que devuelve sobre el archivo y después anadir_material con tipo archivo.
  · Si el comando falla por falta de red, dile al profesor que añada el dominio del enlace a los dominios permitidos de la ejecución de código en su configuración de Claude, o que suba el archivo desde la sesión en Aula26.
- Si una entrega es un archivo .fig, leer_archivo te da su estructura (páginas, frames, textos, componentes, auto layout, tipografías, colores) y una miniatura de la primera página, pero no imágenes de cada pantalla: tenlo en cuenta al valorar lo visual y dilo en el comentario si no puedes juzgarlo.
- Si una entrega es un enlace de Figma, revísalo con el conector de Figma (captura, estructura y contexto de diseño) si lo tienes disponible. Si no puedes abrirlo, dilo en vez de inventar la evaluación.`;

const ok = (data: unknown): CallToolResult => ({ content: [{ type: "text", text: JSON.stringify(data, null, 1) }] });
const fail = (message: string): CallToolResult => ({ content: [{ type: "text", text: message }], isError: true });

const fecha = (d: Date | null | undefined) => (d ? toLocalInput(d) : null);
const estado = (publishAt: Date | null) =>
  !publishAt ? "borrador" : isPublished(publishAt) ? "publicada" : `programada para ${fecha(publishAt)}`;
const nombre = (u: { firstName: string; lastName: string; email: string }) =>
  [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;

function parseFecha(value: string) {
  const d = parseLocal(value);
  if (!d) throw new Forbidden(`Fecha no válida: "${value}". Usa el formato 2026-10-06T09:30`);
  return d;
}

async function managedLesson(actor: User, lessonId: string) {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson || !(await canManageSubject(actor.id, actor.isAdmin, lesson.subjectId))) throw new Forbidden("La sesión no existe");
  return lesson;
}

async function managedMaterial(actor: User, materialId: string) {
  const m = await db.material.findUnique({ where: { id: materialId }, include: { lesson: true, file: true } });
  if (!m || !(await canManageSubject(actor.id, actor.isAdmin, m.lesson.subjectId))) throw new Forbidden("El material no existe");
  return m;
}

async function managedAssessment(actor: User, assessmentId: string) {
  const a = await db.assessment.findUnique({ where: { id: assessmentId }, include: { lesson: true } });
  if (!a || !(await canManageSubject(actor.id, actor.isAdmin, a.lesson.subjectId))) throw new Forbidden("La tarea no existe");
  return a;
}

// Entregas reales (con fecha de entrega): las que no se pueden perder al borrar.
const submittedCount = (where: { assessmentId: string } | { assessment: { lessonId: string } }) =>
  db.submission.count({ where: { ...where, submittedAt: { not: null } } });

// Convierte nota / entregada en el valor que se guarda según el tipo de tarea.
async function gradeFor(tareaId: string, a: { nota?: number; entregada?: boolean }) {
  const t = await db.assessment.findUnique({ where: { id: tareaId }, select: { gradingMode: true } });
  if (!t) throw new Forbidden("La tarea no existe");
  if (t.gradingMode === "COMPLETION") {
    if (a.entregada === undefined) throw new Forbidden("Esta tarea se valora como entregada / no entregada: usa el campo entregada");
    return a.entregada ? COMPLETION_DONE : 0;
  }
  if (a.nota === undefined) throw new Forbidden("Esta tarea se evalúa con nota de 0 a 10: usa el campo nota");
  return Math.round(a.nota * 100) / 100;
}

// "ya", "2026-10-06T08:00" o null (con la sesión).
function publishDate(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return value === "ya" ? new Date() : parseFecha(value);
}

// Envuelve cada herramienta: los errores de permisos o validación vuelven a Claude como texto.
function run<A>(fn: (args: A) => Promise<CallToolResult>) {
  return async (args: A) => {
    try {
      return await fn(args);
    } catch (e) {
      if (e instanceof Forbidden) return fail(e.message);
      if (e instanceof z.ZodError) return fail(`Datos no válidos: ${e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
      console.error("[mcp]", e);
      return fail("Error interno de Aula26.");
    }
  };
}

const MAX_INLINE_BYTES = 3 * 1024 * 1024;
const MIME: Record<string, string> = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
  md: "text/markdown", txt: "text/plain", html: "text/html", csv: "text/csv", json: "application/json", zip: "application/zip",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
const mimeFor = (name: string) => MIME[/\.([^.]+)$/.exec(name.toLowerCase())?.[1] ?? ""] ?? "application/octet-stream";

const MAX_READ_BYTES = 15 * 1024 * 1024;
const MAX_TEXT_CHARS = 200_000;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

async function docxText(data: Buffer) {
  const zip = await JSZip.loadAsync(data);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) return null;
  return xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

export function buildMcpServer(actor: User) {
  const server = new McpServer({ name: "Aula26", version: "1.0.0" }, { instructions: INSTRUCTIONS });
  const lectura = { readOnlyHint: true, openWorldHint: false };
  const escritura = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
  const borrado = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };

  server.registerTool(
    "listar_asignaturas",
    { title: "Listar asignaturas", description: "Las asignaturas que impartes, con su id.", inputSchema: {}, annotations: lectura },
    run(async () => {
      const subjects = await db.subject.findMany({
        where: actor.isAdmin ? {} : { enrollments: { some: { userId: actor.id, role: "TEACHER" } } },
        include: { _count: { select: { enrollments: { where: { role: "STUDENT" } } } } },
        orderBy: [{ academicYear: "desc" }, { name: "asc" }],
      });
      return ok(subjects.map((s) => ({ id: s.id, nombre: s.name, curso: s.academicYear, grupo: s.group, alumnado: s._count.enrollments })));
    }),
  );

  server.registerTool(
    "ver_asignatura",
    {
      title: "Ver la programación",
      description: "Todas las sesiones de una asignatura con su programa, materiales y tareas (también los borradores).",
      inputSchema: { asignatura_id: z.string() },
      annotations: lectura,
    },
    run(async ({ asignatura_id }: { asignatura_id: string }) => {
      if (!(await canManageSubject(actor.id, actor.isAdmin, asignatura_id))) throw new Forbidden("La asignatura no existe");
      const lessons = await getTimeline(asignatura_id, true);
      return ok(
        lessons.map((l) => ({
          sesion_id: l.id,
          fecha: fecha(l.date),
          titulo: l.title,
          estado: estado(l.publishAt),
          programa: l.plan,
          materiales: l.materials.map((m) => ({
            material_id: m.id,
            titulo: m.title,
            tipo: { TEXT: "texto", LINK: "enlace", FILE: "archivo" }[m.kind],
            diapositivas: m.isSlides,
            ...(m.kind === "LINK" && { url: m.url }),
            ...(m.kind === "TEXT" && { texto: m.body.length > 2000 ? `${m.body.slice(0, 2000)}… (recortado: léelo entero con ver_material)` : m.body }),
            ...(m.file && { archivo_id: m.file.id, archivo: m.file.name }),
          })),
          tareas: l.assessments.map((a) => ({
            tarea_id: a.id,
            titulo: a.title,
            entrega_hasta: fecha(a.dueAt),
            peso: a.weight,
            evaluacion: a.gradingMode === "COMPLETION" ? "entregada / no entregada" : "nota de 0 a 10",
            admite_archivos: a.acceptsSubmissions,
            extensiones: a.allowedExtensions || null,
            admite_enlace: a.acceptsLink,
            rubrica: a.rubric.trim() ? "sí (en ver_entregas)" : "falta",
          })),
        })),
      );
    }),
  );

  server.registerTool(
    "crear_sesion",
    {
      title: "Crear sesión",
      description: "Crea una sesión nueva en borrador. El programa es Markdown con un paso por línea (\"- Paso (10 min)\").",
      inputSchema: {
        asignatura_id: z.string(),
        fecha: z.string().describe("Hora de Madrid, formato 2026-10-06T09:30"),
        titulo: z.string(),
        programa: z.string().default("").describe("Qué se hará en clase"),
      },
      annotations: escritura,
    },
    run(async (a: { asignatura_id: string; fecha: string; titulo: string; programa: string }) => {
      const l = await createLesson(actor, a.asignatura_id, { date: parseFecha(a.fecha), title: a.titulo, plan: a.programa, publishAt: null });
      return ok({ sesion_id: l.id, estado: "borrador" });
    }),
  );

  server.registerTool(
    "editar_sesion",
    {
      title: "Editar sesión",
      description: "Cambia la fecha, el título o el programa de una sesión. Lo que no indiques se queda igual; si estaba publicada, sigue publicada.",
      inputSchema: { sesion_id: z.string(), fecha: z.string().optional(), titulo: z.string().optional(), programa: z.string().optional() },
      annotations: escritura,
    },
    run(async (a: { sesion_id: string; fecha?: string; titulo?: string; programa?: string }) => {
      const l = await managedLesson(actor, a.sesion_id);
      await updateLesson(actor, l.id, {
        date: a.fecha ? parseFecha(a.fecha) : l.date,
        title: a.titulo ?? l.title,
        plan: a.programa ?? l.plan,
        publishAt: l.publishAt,
      });
      return ok({ sesion_id: l.id, estado: estado(l.publishAt) });
    }),
  );

  server.registerTool(
    "anadir_material",
    {
      title: "Añadir material",
      description: "Añade un texto (Markdown), un enlace o un archivo ya subido con preparar_subida a una sesión.",
      inputSchema: {
        sesion_id: z.string(),
        tipo: z.enum(["texto", "enlace", "archivo"]),
        titulo: z.string(),
        texto: z.string().optional().describe("Para tipo texto: contenido en Markdown"),
        url: z.string().optional().describe("Para tipo enlace"),
        archivo_id: z.string().optional().describe("Para tipo archivo: el que devolvió preparar_subida, ya subido"),
        diapositivas: z.boolean().default(false).describe("Si son las diapositivas de la sesión"),
        publicar_desde: z.string().nullable().optional().describe("Desde cuándo lo ve el alumnado: \"ya\", una fecha (hora de Madrid, 2026-10-06T08:00) o null para que aparezca con la sesión"),
      },
      annotations: escritura,
    },
    run(async (a: { sesion_id: string; tipo: "texto" | "enlace" | "archivo"; titulo: string; texto?: string; url?: string; archivo_id?: string; diapositivas: boolean; publicar_desde?: string | null }) => {
      await managedLesson(actor, a.sesion_id);
      if (a.tipo === "archivo") {
        const f = a.archivo_id ? await db.storedFile.findUnique({ where: { id: a.archivo_id } }) : null;
        if (!f || f.uploadedById !== actor.id) throw new Forbidden("El archivo no existe");
        if (!f.uploadedAt && f.uploadTokenHash) {
          // Subido directamente al almacenamiento: comprobamos que está antes de enlazarlo.
          const exists = await readObject(f.storageKey).then(() => true, () => false);
          if (!exists) throw new Forbidden("El archivo todavía no se ha subido. Ejecuta primero el comando de preparar_subida");
        }
      }
      const m =
        a.tipo === "texto"
          ? await addMaterial(actor, a.sesion_id, { kind: "TEXT", title: a.titulo, body: a.texto ?? "", isSlides: a.diapositivas, publishAt: publishDate(a.publicar_desde) ?? null })
          : a.tipo === "enlace"
            ? await addMaterial(actor, a.sesion_id, { kind: "LINK", title: a.titulo, url: a.url ?? "", isSlides: a.diapositivas, publishAt: publishDate(a.publicar_desde) ?? null })
            : await addMaterial(actor, a.sesion_id, { kind: "FILE", title: a.titulo, fileId: a.archivo_id ?? "", isSlides: a.diapositivas, publishAt: publishDate(a.publicar_desde) ?? null });
      return ok({ material_id: m.id });
    }),
  );

  server.registerTool(
    "borrar_sesion",
    {
      title: "Borrar sesión",
      description: "Borra una sesión con su programa, materiales y tareas. No se puede deshacer. No funciona si alguna de sus tareas tiene entregas.",
      inputSchema: { sesion_id: z.string() },
      annotations: borrado,
    },
    run(async ({ sesion_id }: { sesion_id: string }) => {
      const l = await managedLesson(actor, sesion_id);
      if (await submittedCount({ assessment: { lessonId: l.id } }))
        return fail("La sesión tiene tareas con entregas del alumnado. Para no perderlas, bórrala desde Aula26 si de verdad quieres hacerlo.");
      await deleteLesson(actor, l.id);
      return ok({ borrada: l.title });
    }),
  );

  server.registerTool(
    "ver_material",
    {
      title: "Ver material",
      description: "Un material completo: el texto entero (Markdown), el enlace o el archivo.",
      inputSchema: { material_id: z.string() },
      annotations: lectura,
    },
    run(async ({ material_id }: { material_id: string }) => {
      const m = await managedMaterial(actor, material_id);
      return ok({
        material_id: m.id,
        sesion_id: m.lessonId,
        titulo: m.title,
        tipo: { TEXT: "texto", LINK: "enlace", FILE: "archivo" }[m.kind],
        diapositivas: m.isSlides,
        ...(m.kind === "TEXT" && { texto: m.body }),
        ...(m.kind === "LINK" && { url: m.url }),
        ...(m.file && { archivo_id: m.file.id, archivo: m.file.name }),
      });
    }),
  );

  server.registerTool(
    "editar_material",
    {
      title: "Editar material",
      description:
        "Cambia el título, el texto (sustituye el texto entero: léelo antes con ver_material), el enlace o si son las diapositivas. Lo que no indiques se queda igual. Para cambiar un archivo, borra el material y añade otro.",
      inputSchema: {
        material_id: z.string(),
        titulo: z.string().optional(),
        texto: z.string().optional().describe("Solo materiales de texto: el Markdown completo"),
        url: z.string().optional().describe("Solo enlaces"),
        diapositivas: z.boolean().optional(),
        publicar_desde: z.string().nullable().optional().describe("Desde cuándo lo ve el alumnado: \"ya\", una fecha (hora de Madrid, 2026-10-06T08:00) o null para que aparezca con la sesión"),
      },
      annotations: escritura,
    },
    run(async (a: { material_id: string; titulo?: string; texto?: string; url?: string; diapositivas?: boolean; publicar_desde?: string | null }) => {
      const m = await managedMaterial(actor, a.material_id);
      if (a.texto !== undefined && m.kind !== "TEXT") return fail("Este material no es de texto.");
      if (a.url !== undefined && m.kind !== "LINK") return fail("Este material no es un enlace.");
      await updateMaterial(actor, m.id, { title: a.titulo, body: a.texto, url: a.url, isSlides: a.diapositivas, publishAt: publishDate(a.publicar_desde) });
      return ok({ material_id: m.id, sesion: estado(m.lesson.publishAt) });
    }),
  );

  server.registerTool(
    "borrar_material",
    {
      title: "Borrar material",
      description: "Quita un material de su sesión (y su archivo, si lo tiene). No se puede deshacer.",
      inputSchema: { material_id: z.string() },
      annotations: borrado,
    },
    run(async ({ material_id }: { material_id: string }) => {
      const m = await managedMaterial(actor, material_id);
      await deleteMaterial(actor, m.id);
      return ok({ borrado: m.title });
    }),
  );

  server.registerTool(
    "subir_archivo",
    {
      title: "Subir archivo",
      description:
        "Sube un archivo (hasta 3 MB) como material de una sesión: PDF, diapositivas, plantilla, imagen… Pasa el contenido en base64, o en texto si es un archivo de texto (.md, .html, .csv…).",
      inputSchema: {
        sesion_id: z.string(),
        titulo: z.string().describe("Cómo se verá en la sesión"),
        nombre_archivo: z.string().describe("Con extensión, por ejemplo tema3.pdf"),
        contenido_base64: z.string().optional(),
        texto: z.string().optional().describe("En lugar de base64, para archivos de texto"),
        tipo_mime: z.string().optional().describe("Por ejemplo application/pdf. Si no lo pones, se deduce de la extensión"),
        diapositivas: z.boolean().default(false).describe("Si son las diapositivas de la sesión"),
      },
      annotations: escritura,
    },
    run(async (a: { sesion_id: string; titulo: string; nombre_archivo: string; contenido_base64?: string; texto?: string; tipo_mime?: string; diapositivas: boolean }) => {
      const lesson = await managedLesson(actor, a.sesion_id);
      const data =
        a.contenido_base64 !== undefined ? Buffer.from(a.contenido_base64.replace(/^data:[^,]*,/, ""), "base64") : a.texto !== undefined ? Buffer.from(a.texto, "utf8") : null;
      if (!data || data.length === 0) return fail("Falta el contenido: pasa contenido_base64 o texto.");
      if (data.length > MAX_INLINE_BYTES) return fail("Es demasiado grande para mandarlo así (máximo 3 MB). Usa preparar_subida.");
      const f = await storeFile(actor, lesson.subjectId, { name: a.nombre_archivo, mimeType: a.tipo_mime || mimeFor(a.nombre_archivo), data });
      const m = await addMaterial(actor, a.sesion_id, { kind: "FILE", title: a.titulo, fileId: f.id, isSlides: a.diapositivas });
      return ok({ material_id: m.id, archivo: f.name, bytes: f.size });
    }),
  );

  server.registerTool(
    "preparar_subida",
    {
      title: "Preparar subida de un archivo grande",
      description:
        "Para archivos de hasta 50 MB que tengas en un entorno de ejecución de código con internet. Devuelve un comando curl para subirlo; después usa anadir_material con tipo archivo y el archivo_id.",
      inputSchema: {
        sesion_id: z.string(),
        nombre_archivo: z.string(),
        bytes: z.number().int().positive(),
        tipo_mime: z.string().optional(),
      },
      annotations: escritura,
    },
    run(async (a: { sesion_id: string; nombre_archivo: string; bytes: number; tipo_mime?: string }) => {
      const lesson = await managedLesson(actor, a.sesion_id);
      const t = await startUpload(actor, lesson.subjectId, { name: a.nombre_archivo, size: a.bytes, mimeType: a.tipo_mime || mimeFor(a.nombre_archivo) });
      const url = t.url.startsWith("/") ? `${appUrl()}${t.url}` : t.url;
      const headers = Object.entries({ ...t.headers, "x-upsert": "false" }).map(([k, v]) => `-H '${k}: ${v}'`).join(" ");
      return ok({
        archivo_id: t.fileId,
        comando: `curl -sS -X PUT ${headers} -F 'cacheControl=3600' -F 'file=@${a.nombre_archivo.replace(/'/g, "")}' '${url}'`,
        nota: "Ejecuta el comando en la carpeta del archivo. El enlace caduca en unas horas.",
      });
    }),
  );

  server.registerTool(
    "crear_tarea",
    {
      title: "Crear tarea",
      description: "Crea una tarea o prueba en una sesión.",
      inputSchema: {
        sesion_id: z.string(),
        titulo: z.string(),
        instrucciones: z.string().default("").describe("Markdown"),
        entrega_hasta: z.string().optional().describe("Hora de Madrid, formato 2026-10-06T23:59"),
        peso: z.number().min(0).max(100).default(0).describe("Porcentaje de la nota final"),
        rubrica: z
          .string()
          .trim()
          .min(20, "Toda tarea necesita rúbrica")
          .describe(
            "Obligatoria, en Markdown. Para nota: criterios con su peso o puntos y qué distingue cada nivel. Para entregada: la lista de lo que debe cumplir para contar como entregada",
          ),
        evaluacion: z.enum(["nota", "entregada"]).default("nota").describe("nota: de 0 a 10. entregada: entregada / no entregada (tareas de clase de la PAC)"),
        admite_archivos: z.boolean().default(true),
        extensiones: z.string().default("").describe("Extensiones admitidas, por ejemplo \"pdf, fig\". Vacío = cualquiera"),
        admite_enlace: z.boolean().default(false).describe("Si el alumnado entrega un enlace (Figma, web…)"),
      },
      annotations: escritura,
    },
    run(async (a: {
      sesion_id: string; titulo: string; instrucciones: string; entrega_hasta?: string; peso: number; rubrica: string;
      evaluacion: "nota" | "entregada"; admite_archivos: boolean; extensiones: string; admite_enlace: boolean;
    }) => {
      await managedLesson(actor, a.sesion_id);
      const t = await addAssessment(actor, a.sesion_id, {
        title: a.titulo,
        instructions: a.instrucciones,
        dueAt: a.entrega_hasta ? parseFecha(a.entrega_hasta) : null,
        weight: a.peso,
        rubric: a.rubrica,
        acceptsSubmissions: a.admite_archivos,
        acceptsLink: a.admite_enlace,
        allowedExtensions: a.extensiones,
        gradingMode: a.evaluacion === "entregada" ? "COMPLETION" : "SCORE",
      });
      return ok({ tarea_id: t.id });
    }),
  );

  server.registerTool(
    "editar_tarea",
    {
      title: "Editar tarea",
      description: "Cambia los datos de una tarea. Lo que no indiques se queda igual. El tipo de evaluación no se puede cambiar si ya hay notas o propuestas.",
      inputSchema: {
        tarea_id: z.string(),
        titulo: z.string().optional(),
        instrucciones: z.string().optional().describe("Markdown completo: sustituye al anterior"),
        entrega_hasta: z.string().nullable().optional().describe("Hora de Madrid, formato 2026-10-06T23:59; null para quitar el plazo"),
        peso: z.number().min(0).max(100).optional(),
        rubrica: z.string().optional().describe("Markdown completo: sustituye a la anterior"),
        evaluacion: z.enum(["nota", "entregada"]).optional(),
        admite_archivos: z.boolean().optional(),
        extensiones: z.string().optional(),
        admite_enlace: z.boolean().optional(),
        publicar_desde: z.string().nullable().optional().describe("Desde cuándo lo ve el alumnado: \"ya\", una fecha (hora de Madrid, 2026-10-06T08:00) o null para que aparezca con la sesión"),
      },
      annotations: escritura,
    },
    run(async (a: {
      publicar_desde?: string | null;
      tarea_id: string; titulo?: string; instrucciones?: string; entrega_hasta?: string | null; peso?: number; rubrica?: string;
      evaluacion?: "nota" | "entregada"; admite_archivos?: boolean; extensiones?: string; admite_enlace?: boolean;
    }) => {
      const t = await managedAssessment(actor, a.tarea_id);
      await updateAssessment(actor, t.id, {
        title: a.titulo,
        instructions: a.instrucciones,
        dueAt: a.entrega_hasta === undefined ? undefined : a.entrega_hasta === null ? null : parseFecha(a.entrega_hasta),
        weight: a.peso,
        rubric: a.rubrica,
        gradingMode: a.evaluacion === undefined ? undefined : a.evaluacion === "entregada" ? "COMPLETION" : "SCORE",
        acceptsSubmissions: a.admite_archivos,
        allowedExtensions: a.extensiones,
        acceptsLink: a.admite_enlace,
        publishAt: publishDate(a.publicar_desde),
      });
      return ok({ tarea_id: t.id, sesion: estado(t.lesson.publishAt) });
    }),
  );

  server.registerTool(
    "borrar_tarea",
    {
      title: "Borrar tarea",
      description: "Borra una tarea. No se puede deshacer. No funciona si ya tiene entregas del alumnado.",
      inputSchema: { tarea_id: z.string() },
      annotations: borrado,
    },
    run(async ({ tarea_id }: { tarea_id: string }) => {
      const t = await managedAssessment(actor, tarea_id);
      if (await submittedCount({ assessmentId: t.id }))
        return fail("La tarea ya tiene entregas del alumnado. Para no perderlas, bórrala desde Aula26 si de verdad quieres hacerlo.");
      await deleteAssessment(actor, t.id);
      return ok({ borrada: t.title });
    }),
  );

  server.registerTool(
    "ver_entregas",
    {
      title: "Ver entregas",
      description: "La tarea (instrucciones y rúbrica) y la entrega de cada alumno o alumna, con sus archivos, nota y propuesta.",
      inputSchema: { tarea_id: z.string() },
      annotations: lectura,
    },
    run(async ({ tarea_id }: { tarea_id: string }) => {
      const { assessment: a, rows } = await getSubmissionsOverview(actor, tarea_id);
      const completion = a.gradingMode === "COMPLETION";
      const valor = (g: number | null) => (completion && g !== null ? (g > 0 ? "entregada" : "no entregada") : g);
      return ok({
        tarea: {
          titulo: a.title,
          instrucciones: a.instructions,
          rubrica: a.rubric,
          entrega_hasta: fecha(a.dueAt),
          evaluacion: completion ? "entregada / no entregada" : "nota de 0 a 10",
          notas_publicadas: a.gradesPublished,
        },
        entregas: rows.map(({ student, submission: s, status }) => ({
          alumno_id: student.id,
          nombre: nombre(student),
          estado: status,
          entregada_el: fecha(s?.submittedAt),
          comentario_del_alumno: s?.note || null,
          enlace: s?.url || null,
          archivos: (s?.files ?? []).map((f) => ({ archivo_id: f.id, nombre: f.name, tipo: f.mimeType, bytes: f.size })),
          nota: s?.gradedAt ? { valor: valor(s.grade), comentario: s.feedback } : null,
          propuesta: s?.draftedAt ? { valor: valor(s.draftGrade), comentario: s.draftFeedback } : null,
        })),
      });
    }),
  );

  server.registerTool(
    "leer_archivo",
    {
      title: "Leer archivo",
      description: "El contenido de un archivo de una entrega o material: texto, Word (.docx), PDF, imagen o Figma (.fig: estructura de capas, textos, componentes, tipografías, colores y miniatura de la primera página).",
      inputSchema: { archivo_id: z.string() },
      annotations: lectura,
    },
    run(async ({ archivo_id }: { archivo_id: string }) => {
      const f = await fileForDownload(actor, archivo_id);
      if (!f || !f.uploadedAt || !(await canManageSubject(actor.id, actor.isAdmin, f.subjectId))) throw new Forbidden("El archivo no existe");
      if (f.size > MAX_READ_BYTES) return fail(`"${f.name}" es demasiado grande para leerlo (${Math.round(f.size / 1024 / 1024)} MB).`);
      const data = await readObject(f.storageKey);
      const lower = f.name.toLowerCase();
      if (IMAGE_TYPES.includes(f.mimeType)) {
        return { content: [{ type: "image", data: data.toString("base64"), mimeType: f.mimeType }] };
      }
      if (f.mimeType === "application/pdf" || lower.endsWith(".pdf")) {
        return {
          content: [
            { type: "resource", resource: { uri: `aula26://archivos/${f.id}`, mimeType: "application/pdf", blob: data.toString("base64") } },
          ],
        };
      }
      if (lower.endsWith(".fig")) {
        const fig = await readFig(data).catch((e) => {
          console.error("[mcp] .fig", e);
          return null;
        });
        if (!fig) return fail(`No he podido leer «${f.name}»: quizá es de una versión de Figma que todavía no sé abrir. Pide un PDF exportado o el enlace.`);
        const content: CallToolResult["content"] = [{ type: "text", text: `Archivo: ${f.name}\n${fig.summary}` }];
        if (fig.thumbnail) content.push({ type: "image", data: fig.thumbnail.toString("base64"), mimeType: "image/png" });
        return { content };
      }
      let text: string | null = null;
      if (lower.endsWith(".docx")) text = await docxText(data).catch(() => null);
      else if (f.mimeType.startsWith("text/") || /\.(txt|md|csv|json|py|js|ts|java|c|cpp|html|css|sql)$/.test(lower)) text = data.toString("utf8");
      if (text === null) return fail(`No sé leer "${f.name}" (${f.mimeType}). El profesor puede abrirlo desde Aula26.`);
      const cut = text.length > MAX_TEXT_CHARS;
      return ok({ archivo: f.name, texto: cut ? text.slice(0, MAX_TEXT_CHARS) : text, ...(cut && { aviso: "Recortado" }) });
    }),
  );

  server.registerTool(
    "proponer_nota",
    {
      title: "Proponer nota",
      description:
        "Propone la evaluación de una entrega con un comentario: una nota de 0 a 10, o entregada / no entregada según el tipo de tarea. No cuenta ni la ve el alumnado hasta que el profesor la acepta.",
      inputSchema: {
        tarea_id: z.string(),
        alumno_id: z.string(),
        nota: z.number().min(0).max(10).optional().describe("Para tareas con nota de 0 a 10"),
        entregada: z.boolean().optional().describe("Para tareas de entregada / no entregada"),
        comentario: z.string().describe("Para el estudiante: qué funciona, qué no y qué mejorar, con criterio"),
      },
      annotations: { ...escritura, idempotentHint: true },
    },
    run(async (a: { tarea_id: string; alumno_id: string; nota?: number; entregada?: boolean; comentario: string }) => {
      const grade = await gradeFor(a.tarea_id, a);
      await proposeGrade(actor, a.tarea_id, a.alumno_id, { grade, feedback: a.comentario });
      return ok({ propuesta: "guardada", revisa: "El profesor la verá en la página de entregas de la tarea." });
    }),
  );

  server.registerTool(
    "publicar_sesion",
    {
      title: "Publicar sesión",
      description:
        "Cambia la visibilidad de una sesión: publicada (ya), programada (desde una fecha) o borrador. Hasta el día de la sesión el alumnado solo ve su título y fecha.",
      inputSchema: {
        sesion_id: z.string(),
        estado: z.enum(["publicada", "programada", "borrador"]),
        desde: z.string().optional().describe("Para programada: hora de Madrid, 2026-10-05T08:00"),
      },
      annotations: escritura,
    },
    run(async (a: { sesion_id: string; estado: "publicada" | "programada" | "borrador"; desde?: string }) => {
      const l = await managedLesson(actor, a.sesion_id);
      if (a.estado === "programada" && !a.desde) return fail("Para programarla, indica desde cuándo con el campo desde.");
      const publishAt = a.estado === "borrador" ? null : a.estado === "publicada" ? new Date() : parseFecha(a.desde!);
      await updateLesson(actor, l.id, { date: l.date, title: l.title, plan: l.plan, publishAt });
      return ok({ sesion_id: l.id, estado: estado(publishAt) });
    }),
  );

  server.registerTool(
    "poner_nota",
    {
      title: "Poner nota",
      description:
        "Pone la nota definitiva de una entrega (no una propuesta), con su comentario. Úsala solo cuando el profesor te lo pida expresamente; si no, usa proponer_nota. El alumnado la ve cuando se publiquen las notas de la tarea.",
      inputSchema: {
        tarea_id: z.string(),
        alumno_id: z.string(),
        nota: z.number().min(0).max(10).optional().describe("Para tareas con nota de 0 a 10"),
        entregada: z.boolean().optional().describe("Para tareas de entregada / no entregada"),
        comentario: z.string().default(""),
      },
      annotations: { ...escritura, idempotentHint: true },
    },
    run(async (a: { tarea_id: string; alumno_id: string; nota?: number; entregada?: boolean; comentario: string }) => {
      const grade = await gradeFor(a.tarea_id, a);
      await gradeSubmission(actor, a.tarea_id, a.alumno_id, { grade, feedback: a.comentario });
      return ok({ nota: "guardada" });
    }),
  );

  server.registerTool(
    "aceptar_propuestas",
    {
      title: "Aceptar propuestas de nota",
      description: "Convierte en definitivas las propuestas de nota de una tarea: las de todo el alumnado o solo la de un alumno o alumna.",
      inputSchema: { tarea_id: z.string(), alumno_id: z.string().optional() },
      annotations: escritura,
    },
    run(async (a: { tarea_id: string; alumno_id?: string }) => {
      const { rows } = await getSubmissionsOverview(actor, a.tarea_id);
      let aceptadas = 0;
      for (const { student, submission: s } of rows) {
        if ((a.alumno_id && student.id !== a.alumno_id) || !s || s.draftGrade === null) continue;
        await gradeSubmission(actor, a.tarea_id, student.id, { grade: s.draftGrade, feedback: s.draftFeedback });
        aceptadas++;
      }
      return ok({ aceptadas });
    }),
  );

  server.registerTool(
    "descartar_propuesta",
    {
      title: "Descartar propuesta de nota",
      description: "Descarta la propuesta de nota de un alumno o alumna sin tocar su nota definitiva.",
      inputSchema: { tarea_id: z.string(), alumno_id: z.string() },
      annotations: { ...escritura, idempotentHint: true },
    },
    run(async (a: { tarea_id: string; alumno_id: string }) => {
      await discardProposal(actor, a.tarea_id, a.alumno_id);
      return ok({ descartada: true });
    }),
  );

  server.registerTool(
    "publicar_notas",
    {
      title: "Publicar notas",
      description: "Publica (o retira) las notas y comentarios de una tarea para que el alumnado los vea.",
      inputSchema: { tarea_id: z.string(), publicar: z.boolean().default(true) },
      annotations: { ...escritura, idempotentHint: true },
    },
    run(async (a: { tarea_id: string; publicar: boolean }) => {
      await setGradesPublished(actor, a.tarea_id, a.publicar);
      return ok({ notas: a.publicar ? "publicadas" : "ocultas" });
    }),
  );

  // ---------- Personas ----------

  const managedSubject = async (subjectId: string) => {
    if (!(await canManageSubject(actor.id, actor.isAdmin, subjectId))) throw new Forbidden("La asignatura no existe");
    return db.subject.findUniqueOrThrow({ where: { id: subjectId } });
  };

  server.registerTool(
    "ver_personas",
    {
      title: "Ver personas",
      description:
        "Profesorado y alumnado de una asignatura (con su id de matrícula), las plazas del listado sin correo y el enlace de inscripción.",
      inputSchema: { asignatura_id: z.string() },
      annotations: lectura,
    },
    run(async ({ asignatura_id }: { asignatura_id: string }) => {
      const subject = await managedSubject(asignatura_id);
      const [enrollments, seats] = await Promise.all([
        db.enrollment.findMany({
          where: { subjectId: subject.id },
          include: { user: true },
          orderBy: [{ role: "desc" }, { user: { lastName: "asc" } }, { user: { firstName: "asc" } }],
        }),
        db.seat.findMany({ where: { subjectId: subject.id }, include: { user: true }, orderBy: { name: "asc" } }),
      ]);
      return ok({
        personas: enrollments.map((e) => ({
          matricula_id: e.id,
          alumno_id: e.userId,
          nombre: nombre(e.user),
          correo: e.user.email,
          rol: e.role === "TEACHER" ? "profesorado" : "alumnado",
        })),
        plazas: seats.map((p) => ({ plaza_id: p.id, nombre: p.name, ocupada_por: p.user?.email ?? null })),
        enlace_inscripcion: subject.joinCode ? `${appUrl()}/unirse/${subject.joinCode}` : null,
        solo_correos_de: subject.emailDomain || null,
      });
    }),
  );

  server.registerTool(
    "anadir_personas",
    {
      title: "Añadir personas",
      description: "Matricula personas por correo (crea su cuenta si no la tienen). Entran con su correo y un código.",
      inputSchema: {
        asignatura_id: z.string(),
        personas: z
          .array(
            z.object({
              correo: z.string(),
              nombre: z.string().default(""),
              apellidos: z.string().default(""),
              rol: z.enum(["alumnado", "profesorado"]).default("alumnado"),
            }),
          )
          .min(1)
          .max(500),
      },
      annotations: escritura,
    },
    run(async (a: { asignatura_id: string; personas: { correo: string; nombre: string; apellidos: string; rol: "alumnado" | "profesorado" }[] }) => {
      const r = await enrollPeople(
        actor,
        a.asignatura_id,
        a.personas.map((p) => ({
          email: p.correo.trim().toLowerCase(),
          firstName: p.nombre.trim(),
          lastName: p.apellidos.trim(),
          role: p.rol === "profesorado" ? "TEACHER" : "STUDENT",
        })),
      );
      return ok({ cuentas_nuevas: r.created, matriculadas: r.enrolled, ya_estaban: r.alreadyEnrolled });
    }),
  );

  server.registerTool(
    "cambiar_rol",
    {
      title: "Cambiar rol",
      description: "Pasa a una persona de alumnado a profesorado o al revés.",
      inputSchema: { asignatura_id: z.string(), matricula_id: z.string(), rol: z.enum(["alumnado", "profesorado"]) },
      annotations: { ...escritura, idempotentHint: true },
    },
    run(async (a: { asignatura_id: string; matricula_id: string; rol: "alumnado" | "profesorado" }) => {
      await setRole(actor, a.asignatura_id, a.matricula_id, a.rol === "profesorado" ? "TEACHER" : "STUDENT");
      return ok({ rol: a.rol });
    }),
  );

  server.registerTool(
    "dar_de_baja",
    {
      title: "Dar de baja",
      description: "Saca a una persona de la asignatura. Sus entregas se conservan y vuelven si se la matricula otra vez.",
      inputSchema: { asignatura_id: z.string(), matricula_id: z.string() },
      annotations: borrado,
    },
    run(async (a: { asignatura_id: string; matricula_id: string }) => {
      await unenroll(actor, a.asignatura_id, a.matricula_id);
      return ok({ baja: true });
    }),
  );

  server.registerTool(
    "gestionar_inscripcion",
    {
      title: "Inscripción con enlace",
      description:
        "Para listados sin correo: añade nombres como plazas, quita una plaza libre, crea o renueva el enlace de inscripción (el anterior deja de funcionar), lo desactiva o limita el dominio de correo.",
      inputSchema: {
        asignatura_id: z.string(),
        anadir_plazas: z.array(z.string()).max(500).optional().describe("Nombres completos tal como los verá el alumnado"),
        quitar_plaza_id: z.string().optional().describe("Solo plazas libres"),
        enlace: z.enum(["crear", "renovar", "desactivar"]).optional(),
        dominio_correo: z.string().optional().describe("Por ejemplo alumnado.esada.es; vacío para cualquiera"),
      },
      annotations: escritura,
    },
    run(async (a: { asignatura_id: string; anadir_plazas?: string[]; quitar_plaza_id?: string; enlace?: "crear" | "renovar" | "desactivar"; dominio_correo?: string }) => {
      const subjectId = (await managedSubject(a.asignatura_id)).id;
      const r: Record<string, unknown> = {};
      if (a.anadir_plazas?.length) r.plazas = await addSeats(actor, subjectId, a.anadir_plazas);
      if (a.quitar_plaza_id) await removeSeat(actor, subjectId, a.quitar_plaza_id);
      if (a.enlace === "crear") await ensureJoinCode(actor, subjectId);
      if (a.enlace === "renovar") await newJoinCode(actor, subjectId);
      if (a.enlace === "desactivar") await disableJoin(actor, subjectId);
      if (a.dominio_correo !== undefined) await setEmailDomain(actor, subjectId, a.dominio_correo);
      const s = await db.subject.findUniqueOrThrow({ where: { id: subjectId } });
      return ok({ ...r, enlace_inscripcion: s.joinCode ? `${appUrl()}/unirse/${s.joinCode}` : null, solo_correos_de: s.emailDomain || null });
    }),
  );

  // ---------- Asignaturas ----------

  server.registerTool(
    "crear_asignatura",
    {
      title: "Crear asignatura",
      description: "Crea una asignatura nueva (solo administración). Después añade personas o plazas.",
      inputSchema: { nombre: z.string(), curso: z.string().describe("Por ejemplo 2026-27"), grupo: z.string().default("") },
      annotations: escritura,
    },
    run(async (a: { nombre: string; curso: string; grupo: string }) => {
      const s = await createSubject(actor, { name: a.nombre, academicYear: a.curso, group: a.grupo });
      return ok({ asignatura_id: s.id });
    }),
  );

  server.registerTool(
    "editar_asignatura",
    {
      title: "Editar asignatura",
      description: "Cambia el nombre, el curso o el grupo de una asignatura (solo administración).",
      inputSchema: { asignatura_id: z.string(), nombre: z.string().optional(), curso: z.string().optional(), grupo: z.string().optional() },
      annotations: escritura,
    },
    run(async (a: { asignatura_id: string; nombre?: string; curso?: string; grupo?: string }) => {
      const s = await managedSubject(a.asignatura_id);
      await updateSubject(actor, s.id, { name: a.nombre ?? s.name, academicYear: a.curso ?? s.academicYear, group: a.grupo ?? s.group });
      return ok({ asignatura_id: s.id });
    }),
  );

  return server;
}
