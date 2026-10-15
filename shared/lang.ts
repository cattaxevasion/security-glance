// 언어 점검에 쓰는 공용 판별식. 수집기·검사 스크립트가 같이 쓴다.
// - 일본어 화면에 한글이 새어 나가지 않게
// - 한국어 화면에 번역되지 않은 일본어가 남지 않게

/** 한글 음절·자모 */
export const HANGUL = /[가-힣ᄀ-ᇿ㄰-㆏]/;

export const hasHangul = (s: string | null | undefined): boolean => !!s && HANGUL.test(s);

/** 가나·한자. 가운뎃점(・)은 한국어 문장에도 구분 기호로 섞이곤 해서 뺀다. */
export const JAPANESE = /[぀-ゟ゠-ヺー-ヿㇰ-ㇿ㐀-䶿一-鿿ｦ-ﾟ]/;

/** 괄호 속 원문 병기. 예: 다이이치생명(第一生命保険) */
const PARENS = /[(（][^()（）]*[)）]/g;

/** 한국어 문장에 일본어가 그대로 남았는지. 처음 한 번 괄호로 원문을 붙인 것은 허용한다. */
export const hasRawJapanese = (s: string | null | undefined): boolean =>
  !!s && JAPANESE.test(s.replace(PARENS, ""));
