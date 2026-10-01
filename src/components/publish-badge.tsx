import { formatDateTime } from "@/lib/time";

export function PublishBadge({ publishAt }: { publishAt: Date | null }) {
  if (!publishAt) return <span className="badge text-gris">Borrador</span>;
  if (publishAt > new Date())
    return <span className="badge border-ocre bg-ocre text-grafito">Programada · {formatDateTime(publishAt)}</span>;
  return null;
}
