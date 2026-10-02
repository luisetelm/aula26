import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import JSZip from "jszip";
import { z } from "zod";
import type { User } from "@prisma/client";
import { db } from "./db";
import { canManageSubject } from "./auth";
import { Forbidden, addAssessment, addMaterial, createLesson, fileForDownload, getTimeline, isPublished, updateLesson } from "./content";
import { getSubmissionsOverview, proposeGrade } from "./submissions";
import { readObject } from "./storage";
import { parseLocal, toLocalInput } from "./time";

// Servidor MCP de Aula26: lo que Claude puede hacer en nombre de un profesor.
// Reutiliza content.ts y submissions.ts, que comprueban los permisos. Claude nunca publica,
// borra ni pone notas definitivas: crea borradores y propone notas que el profesor revisa.

const INSTRUCTIONS = `Aula26 es el aula virtual del profesor. Escribe siempre en español, con tuteo y lenguaje inclusivo ("alumnado", "profesorado").
- Las fechas van en hora de Madrid con el formato "2026-10-06T09:30".
- Todo lo que crees queda como borrador: el profesor lo revisa y lo publica desde Aula26.
- Solo puedes añadir materiales y tareas, o editar, en sesiones que estén en borrador.
- El programa de una sesión es Markdown; cada paso en una línea que empiece por "- " y, si quieres, con la duración al final: "- Repaso de la sesión anterior (10 min)".
- Para corregir: ver_entregas, leer_archivo de cada entrega y proponer_nota con una nota de 0 a 10 y un comentario breve, concreto y amable dirigido al alumno o alumna. El profesor revisa cada propuesta antes de que cuente.`;

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

async function draftLesson(actor: User, lessonId: string) {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson || !(await canManageSubject(actor.id, actor.isAdmin, lesson.subjectId))) throw new Forbidden("La sesión no existe");
  if (lesson.publishAt) throw new Forbidden("La sesión ya está publicada o programada. Pide al profesor que la pase a borrador, o crea una sesión nueva");
  return lesson;
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
            titulo: m.title,
            tipo: { TEXT: "texto", LINK: "enlace", FILE: "archivo" }[m.kind],
            diapositivas: m.isSlides,
            ...(m.kind === "LINK" && { url: m.url }),
            ...(m.kind === "TEXT" && { texto: m.body.slice(0, 2000) }),
            ...(m.file && { archivo_id: m.file.id, archivo: m.file.name }),
          })),
          tareas: l.assessments.map((a) => ({
            tarea_id: a.id,
            titulo: a.title,
            entrega_hasta: fecha(a.dueAt),
            peso: a.weight,
            admite_entregas: a.acceptsSubmissions,
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
      description: "Cambia la fecha, el título o el programa de una sesión en borrador. Lo que no indiques se queda igual.",
      inputSchema: { sesion_id: z.string(), fecha: z.string().optional(), titulo: z.string().optional(), programa: z.string().optional() },
      annotations: escritura,
    },
    run(async (a: { sesion_id: string; fecha?: string; titulo?: string; programa?: string }) => {
      const l = await draftLesson(actor, a.sesion_id);
      await updateLesson(actor, l.id, {
        date: a.fecha ? parseFecha(a.fecha) : l.date,
        title: a.titulo ?? l.title,
        plan: a.programa ?? l.plan,
        publishAt: null,
      });
      return ok({ sesion_id: l.id, estado: "borrador" });
    }),
  );

  server.registerTool(
    "anadir_material",
    {
      title: "Añadir material",
      description: "Añade un texto (Markdown) o un enlace a una sesión en borrador.",
      inputSchema: {
        sesion_id: z.string(),
        tipo: z.enum(["texto", "enlace"]),
        titulo: z.string(),
        texto: z.string().optional().describe("Para tipo texto: contenido en Markdown"),
        url: z.string().optional().describe("Para tipo enlace"),
        diapositivas: z.boolean().default(false).describe("Si el enlace son las diapositivas de la sesión"),
      },
      annotations: escritura,
    },
    run(async (a: { sesion_id: string; tipo: "texto" | "enlace"; titulo: string; texto?: string; url?: string; diapositivas: boolean }) => {
      await draftLesson(actor, a.sesion_id);
      const m =
        a.tipo === "texto"
          ? await addMaterial(actor, a.sesion_id, { kind: "TEXT", title: a.titulo, body: a.texto ?? "", isSlides: a.diapositivas })
          : await addMaterial(actor, a.sesion_id, { kind: "LINK", title: a.titulo, url: a.url ?? "", isSlides: a.diapositivas });
      return ok({ material_id: m.id });
    }),
  );

  server.registerTool(
    "crear_tarea",
    {
      title: "Crear tarea",
      description: "Crea una tarea o prueba en una sesión en borrador.",
      inputSchema: {
        sesion_id: z.string(),
        titulo: z.string(),
        instrucciones: z.string().default("").describe("Markdown"),
        entrega_hasta: z.string().optional().describe("Hora de Madrid, formato 2026-10-06T23:59"),
        peso: z.number().min(0).max(100).default(0).describe("Porcentaje de la nota final"),
        rubrica: z.string().default("").describe("Criterios de corrección en Markdown"),
        admite_entregas: z.boolean().default(true),
      },
      annotations: escritura,
    },
    run(async (a: { sesion_id: string; titulo: string; instrucciones: string; entrega_hasta?: string; peso: number; rubrica: string; admite_entregas: boolean }) => {
      await draftLesson(actor, a.sesion_id);
      const t = await addAssessment(actor, a.sesion_id, {
        title: a.titulo,
        instructions: a.instrucciones,
        dueAt: a.entrega_hasta ? parseFecha(a.entrega_hasta) : null,
        weight: a.peso,
        rubric: a.rubrica,
        acceptsSubmissions: a.admite_entregas,
      });
      return ok({ tarea_id: t.id });
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
      return ok({
        tarea: { titulo: a.title, instrucciones: a.instructions, rubrica: a.rubric, entrega_hasta: fecha(a.dueAt), notas_publicadas: a.gradesPublished },
        entregas: rows.map(({ student, submission: s, status }) => ({
          alumno_id: student.id,
          nombre: nombre(student),
          estado: status,
          entregada_el: fecha(s?.submittedAt),
          comentario_del_alumno: s?.note || null,
          archivos: (s?.files ?? []).map((f) => ({ archivo_id: f.id, nombre: f.name, tipo: f.mimeType, bytes: f.size })),
          nota: s?.gradedAt ? { nota: s.grade, comentario: s.feedback } : null,
          propuesta: s?.draftedAt ? { nota: s.draftGrade, comentario: s.draftFeedback } : null,
        })),
      });
    }),
  );

  server.registerTool(
    "leer_archivo",
    {
      title: "Leer archivo",
      description: "El contenido de un archivo de una entrega o material: texto, Word (.docx), PDF o imagen.",
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
      description: "Propone una nota (0 a 10) y un comentario para la entrega de un alumno o alumna. No cuenta ni la ve el alumnado hasta que el profesor la acepta.",
      inputSchema: {
        tarea_id: z.string(),
        alumno_id: z.string(),
        nota: z.number().min(0).max(10),
        comentario: z.string().describe("Para el alumno o alumna: qué está bien y qué mejorar"),
      },
      annotations: { ...escritura, idempotentHint: true },
    },
    run(async (a: { tarea_id: string; alumno_id: string; nota: number; comentario: string }) => {
      await proposeGrade(actor, a.tarea_id, a.alumno_id, { grade: Math.round(a.nota * 100) / 100, feedback: a.comentario });
      return ok({ propuesta: "guardada", revisa: "El profesor la verá en la página de entregas de la tarea." });
    }),
  );

  return server;
}
