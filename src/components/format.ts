const rtf = new Intl.RelativeTimeFormat("ko", { numeric: "auto" });

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = (Date.parse(iso) - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "방금";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

const dayFmt = new Intl.DateTimeFormat("ko", { month: "long", day: "numeric", weekday: "short" });
const fullFmt = new Intl.DateTimeFormat("ko", { dateStyle: "medium", timeStyle: "short" });

export function fullDateTime(iso: string): string {
  return fullFmt.format(new Date(iso));
}

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** "오늘", "어제", 또는 "10월 13일 (월)" */
export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (localDayKey(d) === localDayKey(now)) return "오늘";
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (localDayKey(d) === localDayKey(y)) return "어제";
  return dayFmt.format(d);
}

export function dayKey(iso: string): string {
  return localDayKey(new Date(iso));
}

export function pct(x: number | null | undefined, digits = 1): string {
  return x == null ? "–" : `${(x * 100).toFixed(digits)}%`;
}
