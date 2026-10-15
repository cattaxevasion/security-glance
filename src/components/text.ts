// 화면 언어에 맞는 글을 고르는 도우미. 일본어 화면에는 한글을, 한국어 화면에는 번역 안 된 일본어를 내보내지 않는다.
// (데이터 쪽은 수집기의 언어 점검이 배포 전에 고치고 확인한다. 여기는 그래도 새는 경우를 막는 마지막 안전장치)
// 화면 코드는 언어별 필드를 직접 고르지 말고 반드시 이 도우미를 쓴다 (check:i18n이 검사한다).
import { forceJa, forceKo, hasHangul, hasRawJapanese } from "../../shared/lang";
import { SOURCE_LABELS, type Lang } from "../i18n";

interface Bilingual {
  titleKo: string;
  titleJa: string;
  summaryKo: string[];
  summaryJa: string[];
}

const ko = (s: string) => (hasRawJapanese(s) ? forceKo(s) : s);

/** 한 문장을 언어에 맞게 (브리핑 문장 등) */
export function textOf(lang: Lang, textKo: string, textJa: string): string {
  if (lang === "ko") return ko(textKo);
  return hasHangul(textJa) ? forceJa(textJa) : textJa;
}

export function titleOf(lang: Lang, x: Pick<Bilingual, "titleKo" | "titleJa">, original?: string): string {
  if (lang === "ko") return ko(x.titleKo);
  if (x.titleJa && !hasHangul(x.titleJa)) return x.titleJa;
  // 일본어 제목이 아직 없으면 원제목(일본어·영어)을, 그것도 없으면 한글을 지운 제목을 쓴다
  if (original && !hasHangul(original)) return original;
  return forceJa(x.titleJa || x.titleKo);
}

/** 요약 문장들. 일본어 화면에서는 한글이 섞인 문장을 빼고, 하나도 없으면 빈 배열 */
export function summaryOf(lang: Lang, x: Bilingual): string[] {
  if (lang === "ko") return x.summaryKo.map(ko);
  return x.summaryJa.filter((s) => s && !hasHangul(s));
}

// ── 이름 ──────────────────────────────────────────────────────────────

/** 일본어로 적힌 조직·위협 그룹 이름 → 한국어 읽기 (수집기가 만드는 names-ko.json) */
let readings: Record<string, string> = {};

export function setNameReadings(m: Record<string, string> | null) {
  readings = m ?? {};
}

/**
 * 조직·위협 그룹 이름.
 * - 일본어 화면: 한글로 적힌 이름은 숨긴다
 * - 한국어 화면: 일본어로 적힌 이름은 읽기로 (withOriginal이면 '읽기(원문)'), 읽기가 없으면 숨긴다
 */
export function namesOf(lang: Lang, names: string[], withOriginal = false): string[] {
  if (lang === "ja") return names.filter((n) => !hasHangul(n));
  return names.flatMap((n) => {
    if (!hasRawJapanese(n)) return [n];
    const r = readings[n];
    if (!r) return [];
    return [withOriginal ? `${r}(${n})` : r];
  });
}

/** 출처(매체) 이름의 화면 표기 */
export function sourceLabel(lang: Lang, name: string): string {
  return SOURCE_LABELS[lang][name] ?? name;
}
