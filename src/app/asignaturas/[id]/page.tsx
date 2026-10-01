import { getSubjectAccess } from "@/lib/subject-access";

export default async function SubjectTimeline({ params }: PageProps<"/asignaturas/[id]">) {
  const { id } = await params;
  await getSubjectAccess(id);
  return (
    <div className="card text-slate-600">
      Aún no hay sesiones publicadas en esta asignatura.
    </div>
  );
}
