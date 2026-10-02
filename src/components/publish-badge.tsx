import { formatDateTime } from "@/lib/time";

export function PublishBadge({ publishAt, oscuro = false }: { publishAt: Date | null; oscuro?: boolean }) {
  if (!publishAt) return <span className={`badge ${oscuro ? "text-papel" : "text-gris"}`}>Borrador</span>;
  if (publishAt > new Date())
    return <span className="badge border-ocre bg-ocre text-grafito">Programada · {formatDateTime(publishAt)}</span>;
  return null;
}
