import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSubjectAccess } from "@/lib/subject-access";
import { appUrl } from "@/lib/oauth";
import { addPerson, disableJoinLink, newJoinLink, releaseSeat, removePerson, removeSeat, saveEmailDomain, setRole } from "./actions";
import { RosterImport } from "./roster-import";

export default async function PeoplePage({ params }: PageProps<"/asignaturas/[id]/personas">) {
  const { id } = await params;
  const { canManage, subject } = await getSubjectAccess(id);
  if (!canManage) notFound();

  const enrollments = await db.enrollment.findMany({
    where: { subjectId: id },
    include: { user: true },
    orderBy: [{ role: "asc" }, { user: { lastName: "asc" } }, { user: { email: "asc" } }],
  });
  const students = enrollments.filter((e) => e.role === "STUDENT").length;
  const seats = await db.seat.findMany({ where: { subjectId: id }, include: { user: true }, orderBy: { name: "asc" } });
  const libres = seats.filter((s) => !s.userId).length;
  const enlace = subject.joinCode ? `${appUrl()}/unirse/${subject.joinCode}` : null;

  return (
    <div className="space-y-8">
      <RosterImport subjectId={id} />

      <section className="card space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Inscripción con enlace</h2>
          <p className="text-sm text-gris">
            Para listados sin correos. Cada estudiante abre el enlace, entra con su correo y elige su nombre del listado.
          </p>
        </div>
        {enlace ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 bg-papel px-3 py-2 font-mono text-sm break-all select-all">{enlace}</p>
            <form action={newJoinLink.bind(null, id)}><button className="btn-secondary" title="El enlace anterior deja de funcionar">Cambiar enlace</button></form>
            <form action={disableJoinLink.bind(null, id)}><button className="text-aviso hover:underline">Desactivar</button></form>
          </div>
        ) : (
          <form action={newJoinLink.bind(null, id)}><button className="btn-secondary">Crear enlace de inscripción</button></form>
        )}
        <form action={saveEmailDomain.bind(null, id)} className="flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor="domain">Solo correos de</label>
          <span className="text-gris">@</span>
          <input id="domain" name="domain" defaultValue={subject.emailDomain} placeholder="esada.es" className="input w-48 py-1" />
          <button className="btn-secondary py-1">Guardar</button>
          {!subject.emailDomain && <span className="text-gris">Recomendado: así nadie de fuera puede inscribirse.</span>}
        </form>
        {seats.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">
              Listado · {seats.length - libres} de {seats.length} inscritos
            </p>
            <ul className="divide-y divide-linea text-sm">
              {seats.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    {s.name}
                    {s.user ? <span className="text-gris"> · {s.user.email}</span> : <span className="badge ml-2 text-gris">Pendiente</span>}
                  </span>
                  {s.user ? (
                    <form action={releaseSeat.bind(null, id, s.id)}>
                      <button className="text-acento hover:underline" title="La plaza queda libre y esta cuenta sale de la asignatura">Liberar</button>
                    </form>
                  ) : (
                    <form action={removeSeat.bind(null, id, s.id)}>
                      <button className="text-aviso hover:underline">Quitar</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="mb-4 text-lg font-semibold">Añadir una persona</h2>
        <form action={addPerson.bind(null, id)} className="flex flex-wrap items-end gap-3">
          <input name="email" type="email" required placeholder="correo@escuela.es" className="input flex-1" />
          <input name="firstName" placeholder="Nombre" className="input w-36" />
          <input name="lastName" placeholder="Apellidos" className="input w-44" />
          <select name="role" className="input" defaultValue="STUDENT">
            <option value="STUDENT">Alumno</option>
            <option value="TEACHER">Profesor</option>
          </select>
          <button className="btn-primary">Añadir</button>
        </form>
      </section>

      <section className="card">
        <h2 className="mb-4 text-lg font-semibold">
          Personas · {students} en el alumnado, {enrollments.length - students} en el profesorado
        </h2>
        {enrollments.length === 0 ? (
          <p className="text-gris">Todavía no hay nadie en esta asignatura.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-gris">
              <tr>
                <th className="py-2">Apellidos, nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {enrollments.map((e) => (
                <tr key={e.id} className="border-t border-linea">
                  <td className="py-2">
                    {[e.user.lastName, e.user.firstName].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td>{e.user.email}</td>
                  <td>
                    <form action={setRole.bind(null, id, e.id, e.role === "TEACHER" ? "STUDENT" : "TEACHER")}>
                      <button className="text-left text-acento" title="Cambiar rol">
                        {e.role === "TEACHER" ? "Profesor" : "Alumno"}
                      </button>
                    </form>
                  </td>
                  <td className="text-right">
                    <form action={removePerson.bind(null, id, e.id)}>
                      <button className="text-aviso hover:underline">Quitar</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
