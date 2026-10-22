export function todayLocal(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function shiftDate(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return todayLocal(date);
}

export function formatDay(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatKickoff(iso: string): string {
  if (!iso) return "Time TBD";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Time TBD";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateParam(value: string | null): string | { error: string } {
  if (!value) return todayLocal();
  if (!DATE_RE.test(value)) return { error: "date must be YYYY-MM-DD" };
  const [year, month, day] = value.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    return { error: "date must be a real calendar date" };
  }
  return value;
}
