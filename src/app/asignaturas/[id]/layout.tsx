import Link from "next/link";
import { getSubjectAccess } from "@/lib/subject-access";

export default async function SubjectLayout({ children, params }: LayoutProps<"/asignaturas/[id]">) {
  const { id } = await params;
  const { subject, canManage } = await getSubjectAccess(id);
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <Link href="/" className="text-sm text-gris hover:text-acento">← Mis asignaturas</Link>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">{subject.name}</h1>
      <p className="text-gris">{subject.academicYear}{subject.group && ` · Grupo ${subject.group}`}</p>
      {canManage && (
        <nav className="mt-4 flex gap-4 border-b border-linea text-sm">
          <Link href={`/asignaturas/${id}`} className="pb-2 text-acento">Timeline</Link>
          <Link href={`/asignaturas/${id}/personas`} className="pb-2 text-acento">Personas</Link>
        </nav>
      )}
      <div className="mt-6">{children}</div>
    </main>
  );
}
