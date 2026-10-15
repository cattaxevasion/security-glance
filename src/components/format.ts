import { LOCALE, STRINGS, type Lang } from "../i18n";

export function relativeTime(lang: Lang, iso: string, now = Date.now()): string {
  const rtf = new Intl.RelativeTimeFormat(LOCALE[lang], { numeric: "auto" });
  const diff = (Date.parse(iso) - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return STRINGS[lang].justNow;
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

export function fullDateTime(lang: Lang, iso: string): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function timeOfDay(lang: Lang, iso: string): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(iso),
  );
}

export function shortDate(lang: Lang, iso: string): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { month: "short", day: "numeric" }).format(new Date(iso));
}

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function dayKey(iso: string): string {
  return localDayKey(new Date(iso));
}

/** "오늘", "어제", 또는 "10월 13일 (월)" */
export function dayLabel(
  lang: Lang,
  iso: string,
  labels: { today: string; yesterday: string },
  now = new Date(),
): string {
  const d = new Date(iso);
  if (localDayKey(d) === localDayKey(now)) return labels.today;
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (localDayKey(d) === localDayKey(y)) return labels.yesterday;
  return new Intl.DateTimeFormat(LOCALE[lang], { month: "long", day: "numeric", weekday: "short" }).format(d);
}

export function pct(x: number | null | undefined, digits = 1): string {
  return x == null ? "–" : `${(x * 100).toFixed(digits)}%`;
}

/** n일 전 날짜의 0시 (이 브라우저의 날짜 기준). '최근 7일'은 오늘을 포함한 달력 7일 = dayStart(6)부터 */
export function dayStart(daysAgo: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}
