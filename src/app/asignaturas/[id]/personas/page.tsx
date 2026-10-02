import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSubjectAccess } from "@/lib/subject-access";
import { addPerson, removePerson, setRole } from "./actions";
import { RosterImport } from "./roster-import";

export default async function PeoplePage({ params }: PageProps<"/asignaturas/[id]/personas">) {
  const { id } = await params;
  const { canManage } = await getSubjectAccess(id);
  if (!canManage) notFound();

  const enrollments = await db.enrollment.findMany({
    where: { subjectId: id },
    include: { user: true },
    orderBy: [{ role: "asc" }, { user: { lastName: "asc" } }, { user: { email: "asc" } }],
  });
  const students = enrollments.filter((e) => e.role === "STUDENT").length;

  return (
    <div className="space-y-8">
      <RosterImport subjectId={id} />

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
