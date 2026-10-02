// Las fechas se guardan en UTC y se muestran/introducen en la zona del centro.
export const TIME_ZONE = process.env.APP_TIMEZONE ?? "Europe/Madrid";

function offsetMs(utc: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utc));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(utc / 1000) * 1000;
}

// "2026-10-06T09:30" (hora local del centro) -> Date. Acepta también "2026-10-06".
export function parseLocal(value: string, timeZone = TIME_ZONE): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/.exec(value.trim());
  if (!m) return null;
  const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0));
  let utc = naive - offsetMs(naive, timeZone);
  utc = naive - offsetMs(utc, timeZone); // segunda pasada por los cambios de hora
  return new Date(utc);
}

// Date -> "2026-10-06T09:30" en la zona del centro, para <input type="datetime-local">.
export function toLocalInput(date: Date | null | undefined, timeZone = TIME_ZONE): string {
  if (!date) return "";
  const local = new Date(date.getTime() + offsetMs(date.getTime(), timeZone));
  return local.toISOString().slice(0, 16);
}

export function formatDate(date: Date, timeZone = TIME_ZONE) {
  return new Intl.DateTimeFormat("es-ES", { timeZone, weekday: "long", day: "numeric", month: "long" }).format(date);
}

export function formatDateTime(date: Date, timeZone = TIME_ZONE) {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// "2026-10-06": el día de calendario en la zona del centro.
export function dayKey(date: Date, timeZone = TIME_ZONE) {
  return toLocalInput(date, timeZone).slice(0, 10);
}

// Días de calendario entre hoy y la fecha (0 = hoy, 1 = mañana, -1 = ayer).
export function daysUntil(date: Date, now = new Date(), timeZone = TIME_ZONE) {
  const utc = (k: string) => Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10));
  return Math.round((utc(dayKey(date, timeZone)) - utc(dayKey(now, timeZone))) / 86_400_000);
}

// "hoy", "mañana", "en 3 días", "ayer", "hace 5 días".
export function relativeDay(date: Date, now = new Date(), timeZone = TIME_ZONE) {
  const d = daysUntil(date, now, timeZone);
  if (d === 0) return "hoy";
  if (d === 1) return "mañana";
  if (d === -1) return "ayer";
  return d > 0 ? `en ${d} días` : `hace ${-d} días`;
}

export function dayParts(date: Date, timeZone = TIME_ZONE) {
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-ES", { timeZone, ...o }).format(date);
  return { day: f({ day: "2-digit" }), month: f({ month: "short" }).replace(".", ""), weekday: f({ weekday: "long" }) };
}
