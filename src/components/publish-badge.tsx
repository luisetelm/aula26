import { formatDateTime } from "@/lib/time";

export function PublishBadge({ publishAt }: { publishAt: Date | null }) {
  if (!publishAt) return <span className="badge bg-slate-200 text-slate-700">Borrador</span>;
  if (publishAt > new Date())
    return <span className="badge bg-amber-100 text-amber-900">Programada · {formatDateTime(publishAt)}</span>;
  return null;
}
