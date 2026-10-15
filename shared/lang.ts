// 언어 점검에 쓰는 공용 판별식과 마지막 수단(기계 변환). 수집기·검사 스크립트·화면이 같이 쓴다.
// - 일본어 화면에 한글이 새어 나가지 않게
// - 한국어 화면에 번역되지 않은 일본어가 남지 않게

/** 한글 음절·자모 */
export const HANGUL = /[가-힣ᄀ-ᇿ㄰-㆏]/;

export const hasHangul = (s: string | null | undefined): boolean => !!s && HANGUL.test(s);

/** 가나·한자. 가운뎃점(・)은 한국어 문장에도 구분 기호로 섞이곤 해서 뺀다. */
export const JAPANESE = /[぀-ゟ゠-ヺー-ヿㇰ-ㇿ㐀-䶿一-鿿ｦ-ﾟ]/;

/** 일본식 괄호. 한국어 문장에서는 작은따옴표를 쓴다. */
const JP_BRACKETS = /[「」『』【】]/;

/** 괄호 속 원문 병기. 예: 다이이치생명(第一生命保険) */
const PARENS = /[(（][^()（）]*[)）]/g;

/** 한국어 문장에 일본어가 그대로 남았는지. 처음 한 번 괄호로 원문을 붙인 것은 허용한다. */
export const hasRawJapanese = (s: string | null | undefined): boolean => {
  if (!s) return false;
  const outside = s.replace(PARENS, "");
  return JAPANESE.test(outside) || JP_BRACKETS.test(outside);
};

/** 다시 고쳐 달라고 할 때 짚어 줄 부분: 괄호 밖에 남은 일본어 덩어리 */
export function rawJapaneseSegments(s: string): string[] {
  const out = s.replace(PARENS, " ").match(/[぀-ヿㇰ-ㇿ㐀-䶿一-鿿ｦ-ﾟ「」『』【】]+/g) ?? [];
  return [...new Set(out.filter((x) => JAPANESE.test(x) || JP_BRACKETS.test(x)))];
}

/** 다시 번역해 달라고 할 때 짚어 줄 부분: 일본어 문장에 남은 한글 덩어리 */
export function hangulSegments(s: string): string[] {
  return [...new Set(s.match(/[가-힣ᄀ-ᇿ㄰-㆏]+(?:\s+[가-힣ᄀ-ᇿ㄰-㆏]+)*/g) ?? [])];
}

// ── 가나 → 한글 (기계 변환) ─────────────────────────────────────────────
// 모델이 여러 번 고쳐도 일본어가 남을 때만 쓰는 마지막 수단. 외래어 표기법을 단순화한 규칙이다.

const KANA: Record<string, string> = {
  ア: "아", イ: "이", ウ: "우", エ: "에", オ: "오",
  カ: "카", キ: "키", ク: "쿠", ケ: "케", コ: "코",
  ガ: "가", ギ: "기", グ: "구", ゲ: "게", ゴ: "고",
  サ: "사", シ: "시", ス: "스", セ: "세", ソ: "소",
  ザ: "자", ジ: "지", ズ: "즈", ゼ: "제", ゾ: "조",
  タ: "타", チ: "치", ツ: "쓰", テ: "테", ト: "토",
  ダ: "다", ヂ: "지", ヅ: "즈", デ: "데", ド: "도",
  ナ: "나", ニ: "니", ヌ: "누", ネ: "네", ノ: "노",
  ハ: "하", ヒ: "히", フ: "후", ヘ: "헤", ホ: "호",
  バ: "바", ビ: "비", ブ: "부", ベ: "베", ボ: "보",
  パ: "파", ピ: "피", プ: "푸", ペ: "페", ポ: "포",
  マ: "마", ミ: "미", ム: "무", メ: "메", モ: "모",
  ヤ: "야", ユ: "유", ヨ: "요",
  ラ: "라", リ: "리", ル: "루", レ: "레", ロ: "로",
  ワ: "와", ヰ: "이", ヱ: "에", ヲ: "오", ヴ: "부",
  ァ: "아", ィ: "이", ゥ: "우", ェ: "에", ォ: "오", ャ: "야", ュ: "유", ョ: "요", ヮ: "와",
};

const KANA2: Record<string, string> = {
  キャ: "캬", キュ: "큐", キョ: "쿄", ギャ: "갸", ギュ: "규", ギョ: "교",
  シャ: "샤", シュ: "슈", ショ: "쇼", ジャ: "자", ジュ: "주", ジョ: "조",
  チャ: "차", チュ: "추", チョ: "초", ニャ: "냐", ニュ: "뉴", ニョ: "뇨",
  ヒャ: "햐", ヒュ: "휴", ヒョ: "효", ビャ: "뱌", ビュ: "뷰", ビョ: "뵤",
  ピャ: "퍄", ピュ: "퓨", ピョ: "표", ミャ: "먀", ミュ: "뮤", ミョ: "묘",
  リャ: "랴", リュ: "류", リョ: "료",
  ファ: "파", フィ: "피", フェ: "페", フォ: "포", ティ: "티", ディ: "디", デュ: "듀",
  トゥ: "투", ドゥ: "두", ウィ: "위", ウェ: "웨", ウォ: "워",
  シェ: "셰", ジェ: "제", チェ: "체", ヴァ: "바", ヴィ: "비", ヴェ: "베", ヴォ: "보",
};

/** 앞 음절에 받침을 붙인다 (이미 받침이 있거나 한글 음절이 아니면 그대로) */
function addFinal(out: string, final: number): string {
  const last = out.charCodeAt(out.length - 1);
  if (last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 === 0)
    return out.slice(0, -1) + String.fromCharCode(last + final);
  return out;
}

/** 가나를 한글 소리로 옮긴다. 한자 등 가나가 아닌 글자는 그대로 둔다. */
export function kanaToHangul(s: string): string {
  // 히라가나 → 가타카나
  const k = s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
  let out = "";
  for (let i = 0; i < k.length; i++) {
    const two = k.slice(i, i + 2);
    if (KANA2[two]) {
      out += KANA2[two];
      i++;
    } else if (k[i] === "ン") out = /[가-힣]$/.test(out) ? addFinal(out, 4) : out + "응";
    // 촉음: 다음 소리에 따라 ㅂ(パ행) / ㄱ(カ행) / ㅅ(그 밖)
    else if (k[i] === "ッ") out = addFinal(out, /[パピプペポ]/.test(k[i + 1] ?? "") ? 17 : /[カキクケコ]/.test(k[i + 1] ?? "") ? 1 : 19);
    else if (k[i] === "ー") continue;
    else if (k[i] === "・") out += " ";
    else out += KANA[k[i]] ?? k[i];
  }
  return out;
}

/**
 * 마지막 수단: 한국어 문장에 남은 일본어 덩어리를 '한글 소리(원문)'으로 바꾼다.
 * 소리를 알 수 없는 한자만 남으면 원문을 괄호에 넣는다. 결과는 언제나 hasRawJapanese = false.
 */
export function forceKo(s: string): string {
  let out = "";
  let last = 0;
  for (const m of s.matchAll(PARENS)) {
    out += fixOutside(s.slice(last, m.index));
    out += m[0];
    last = m.index! + m[0].length;
  }
  return out + fixOutside(s.slice(last));
}

function fixOutside(part: string): string {
  return part
    .replace(/[「『【]/g, "'")
    .replace(/[」』】]/g, "'")
    .replace(/[぀-ヿㇰ-ㇿ㐀-䶿一-鿿ｦ-ﾟ]+/g, (run) => {
      if (!JAPANESE.test(run)) return run;
      const reading = kanaToHangul(run)
        .replace(/[぀-ヿㇰ-ㇿ㐀-䶿一-鿿ｦ-ﾟ]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return reading ? `${reading}(${run})` : `(${run})`;
    });
}

/** 마지막 수단: 일본어 문장에서 한글 덩어리를 지운다. 결과는 언제나 hasHangul = false. */
export function forceJa(s: string): string {
  return s
    .replace(/[가-힣ᄀ-ᇿ㄰-㆏]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
