// 화면 언어에 맞는 글을 고르는 도우미. 일본어 화면에는 한글이 섞인 문장·이름을 절대 내보내지 않는다.
// (데이터 쪽은 수집기의 언어 점검이 고치지만, 고치기 전이라도 화면에서 새지 않게 하는 마지막 안전장치)
import { hasHangul } from "../../shared/lang";
import type { Lang } from "../i18n";

interface Bilingual {
  titleKo: string;
  titleJa: string;
  summaryKo: string[];
  summaryJa: string[];
}

export function titleOf(lang: Lang, x: Bilingual, original?: string): string {
  if (lang === "ko") return x.titleKo;
  if (x.titleJa && !hasHangul(x.titleJa)) return x.titleJa;
  // 일본어 제목이 아직 없으면 원제목(일본어·영어)을, 그것도 없으면 한국어 제목을 쓴다
  if (original && !hasHangul(original)) return original;
  return x.titleKo;
}

/** 요약 문장들. 일본어 화면에서는 한글이 섞인 문장을 빼고, 하나도 없으면 빈 배열 */
export function summaryOf(lang: Lang, x: Bilingual): string[] {
  if (lang === "ko") return x.summaryKo;
  return x.summaryJa.filter((s) => s && !hasHangul(s));
}

/** 조직·위협 그룹 이름. 일본어 화면에서는 한글로 적힌 이름을 숨긴다 */
export function namesOf(lang: Lang, names: string[]): string[] {
  return lang === "ko" ? names : names.filter((n) => !hasHangul(n));
}
