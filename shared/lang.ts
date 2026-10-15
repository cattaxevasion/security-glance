// 언어 점검에 쓰는 공용 판별식. 일본어 화면에 한글이 새어 나가지 않게 수집기·검사 스크립트가 같이 쓴다.

/** 한글 음절·자모 */
export const HANGUL = /[가-힣ᄀ-ᇿ㄰-㆏]/;

export const hasHangul = (s: string | null | undefined): boolean => !!s && HANGUL.test(s);
