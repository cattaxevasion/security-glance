// 화면 언어에 맞는 글을 고르는 도우미. 일본어 화면에는 한글을, 한국어 화면에는 번역 안 된 일본어를,
// 영어 화면에는 한글·가나·한자를 (괄호 속 원문도) 내보내지 않는다.
// (데이터 쪽은 수집기의 언어 점검이 배포 전에 고치고 확인한다. 여기는 그래도 새는 경우를 막는 마지막 안전장치)
// 화면 코드는 언어별 필드를 직접 고르지 말고 반드시 이 도우미를 쓴다 (check:i18n이 검사한다).
import { forceEn, forceJa, forceKo, hasHangul, hasNonEnglish, hasRawJapanese, JAPANESE } from "../../shared/lang";
import { SOURCE_LABELS, STRINGS, VULN_TYPES, type Lang } from "../i18n";

interface Bilingual {
  titleKo: string;
  titleJa: string;
  /** 영어를 넣기 전의 데이터·파일에는 없을 수 있다 */
  titleEn?: string;
  summaryKo: string[];
  summaryJa: string[];
  summaryEn?: string[];
}

const ko = (s: string) => (hasRawJapanese(s) ? forceKo(s) : s);
const en = (s: string) => (hasNonEnglish(s) ? forceEn(s) : s);

/**
 * 한 문장을 언어에 맞게 (브리핑 문장 등).
 * 영어가 아직 비어 있으면(영어를 넣기 전의 브리핑) 빈 문자열: 부르는 쪽이 안내 문구로 바꾼다 (pendingEn)
 */
export function textOf(lang: Lang, textKo: string, textJa: string, textEn?: string): string {
  if (lang === "ko") return ko(textKo);
  if (lang === "en") return textEn ? en(textEn) : "";
  return hasHangul(textJa) ? forceJa(textJa) : textJa;
}

/** 영어가 아직 없는 칸 대신 보여줄 안내 문구 (그 밖의 언어는 그대로) */
export function pendingEn(lang: Lang, text: string): string {
  return text || (lang === "en" ? STRINGS.en.enPending : text);
}

/** 영어 화면에서 이 항목의 영어가 아직 준비 중인가 (제목·요약 둘 중 하나라도 비어 있으면) */
export function isEnPending(lang: Lang, x: Pick<Bilingual, "titleEn" | "summaryEn">, original?: string): boolean {
  return lang === "en" && (!titleEnOf(x, original) || !x.summaryEn?.length);
}

function titleEnOf(x: Pick<Bilingual, "titleEn">, original?: string): string {
  if (x.titleEn) return en(x.titleEn);
  // 영어 제목이 아직 없으면 원제목이 영어일 때만 그것을 쓴다
  return original && !hasNonEnglish(original) ? original : "";
}

export function titleOf(
  lang: Lang,
  x: Pick<Bilingual, "titleKo" | "titleJa" | "titleEn">,
  original?: string,
): string {
  if (lang === "ko") return ko(x.titleKo);
  if (lang === "en") return titleEnOf(x, original) || STRINGS.en.enPending;
  if (x.titleJa && !hasHangul(x.titleJa)) return x.titleJa;
  // 일본어 제목이 아직 없으면 원제목(일본어·영어)을, 그것도 없으면 한글을 지운 제목을 쓴다
  if (original && !hasHangul(original)) return original;
  return forceJa(x.titleJa || x.titleKo);
}

/** 요약 문장들. 일본어 화면에서는 한글이 섞인 문장을 빼고, 영어 화면에서는 영어가 아닌 글자를 지우고, 하나도 없으면 빈 배열 */
export function summaryOf(lang: Lang, x: Bilingual): string[] {
  if (lang === "ko") return x.summaryKo.map(ko);
  if (lang === "en") return (x.summaryEn ?? []).map(en).filter(Boolean);
  return x.summaryJa.filter((s) => s && !hasHangul(s));
}

// ── 이름 ──────────────────────────────────────────────────────────────

/** 일본어로 적힌 조직·위협 그룹 이름 → 한국어 읽기 (수집기가 만드는 names-ko.json) */
let readings: Record<string, string> = {};
/** 같은 이름 → 영어 표기 (names-en.json) */
let english: Record<string, string> = {};

export function setNameReadings(m: Record<string, string> | null) {
  readings = m ?? {};
}

export function setNameEnglish(m: Record<string, string> | null) {
  english = m ?? {};
}

/**
 * 조직·위협 그룹 이름.
 * - 일본어 화면: 한글로 적힌 이름은 숨긴다
 * - 한국어 화면: 일본어로 적힌 이름은 읽기로 (withOriginal이면 '읽기(원문)'), 읽기가 없으면 숨긴다
 * - 영어 화면: 영어가 아닌 글자로 적힌 이름은 영어 표기로 (원문은 붙이지 않는다), 표기가 없으면 숨긴다
 */
export function namesOf(lang: Lang, names: string[], withOriginal = false): string[] {
  if (lang === "ja") return names.filter((n) => !hasHangul(n));
  if (lang === "en")
    return names.flatMap((n) => {
      if (!hasNonEnglish(n)) return [n];
      const e = english[n];
      return e && !hasNonEnglish(e) ? [e] : [];
    });
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

/** 영문 취약점 이름·설명에서 찾은 취약점 종류 (화면 언어). 모르는 종류면 null */
export function vulnTypeOf(lang: Lang, english: string): string | null {
  const x = english.toLowerCase();
  const hit = VULN_TYPES.find((v) => v.match.some((m) => x.includes(m)));
  return hit ? hit[lang] : null;
}

/** 화면 링크로 써도 되는 주소만 (http·https). 수집기도 거르지만 화면에서 한 번 더 */
export function safeUrl(url: string | null | undefined): string | undefined {
  return url && /^https?:\/\//i.test(url) ? url : undefined;
}

// 괄호 속 일본어 원문: 일본어 글자 범위는 shared/lang.ts의 것을 그대로 쓴다
const ORIGINAL = new RegExp(String.raw`\s*\([^)]*[${JAPANESE.source.slice(1, -1)}][^)]*\)`, "g");

/** 한국어 헤드라인에서 괄호 속 일본어 원문을 뺀다 (영어에는 원문이 없다) (속보 띠·링크 미리보기 이미지는 짧게. 카드·상세에는 그대로 남는다) */
export function shortHeadline(lang: Lang, text: string): string {
  return lang === "ko" ? text.replace(ORIGINAL, "") : text;
}
