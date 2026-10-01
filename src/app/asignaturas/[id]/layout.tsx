import Link from "next/link";
import { getSubjectAccess } from "@/lib/subject-access";

export default async function SubjectLayout({ children, params }: LayoutProps<"/asignaturas/[id]">) {
  const { id } = await params;
  const { subject, canManage } = await getSubjectAccess(id);
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">← Mis asignaturas</Link>
      <h1 className="mt-2 text-2xl font-semibold">{subject.name}</h1>
      <p className="text-slate-600">{subject.academicYear}{subject.group && ` · Grupo ${subject.group}`}</p>
      {canManage && (
        <nav className="mt-4 flex gap-4 border-b border-slate-200 text-sm">
          <Link href={`/asignaturas/${id}`} className="pb-2 hover:text-indigo-700">Timeline</Link>
          <Link href={`/asignaturas/${id}/personas`} className="pb-2 hover:text-indigo-700">Personas</Link>
        </nav>
      )}
      <div className="mt-6">{children}</div>
    </main>
  );
}
