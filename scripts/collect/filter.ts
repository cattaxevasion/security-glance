// 요약 전에 제목만 보고 거르는 키워드. LLM 비용을 아끼려는 1차 필터라서 확실한 것만 넣는다.
// 애매한 기사는 통과시키고, LLM이 '업계 동향'으로 판정하면 그때 버린다.

const PATTERNS: RegExp[] = [
  // 행사·컨퍼런스·세미나
  /컨퍼런스|콘퍼런스|세미나|웨비나|개최한다|개최했다|개최…|성료|참가 신청|부스 운영|전시회/,
  /セミナー|カンファレンス|ウェビナー|展示会|出展/,
  /\b(webinar|conference recap)\b/i,
  // 제품 출시·홍보·협약·수상·인터뷰
  /출시|론칭|선보여|선보인다|업무협약|MOU|파트너십 체결|수상|인증 획득|\[인터뷰\]/,
  /発売|提携|協業|受賞|インタビュー/,
  /\b(partners with|announces partnership|wins award|interview:)/i,
  // 투자·실적·인사
  /자사주|투자 유치|시리즈 [A-D] |실적 발표|영업이익|대표 선임|신임 대표|임원 인사|승진/,
  /資金調達|決算発表|就任|人事異動/,
  /\b(raises \$|funding round|appoints)\b/i,
];

// 사건·위협 단어가 있으면 키워드로 거르지 않고 LLM 판단에 맡긴다 (예: "해킹 여파로 출시 연기")
const INCIDENT =
  /해킹|유출|랜섬|취약점|침해|공격|악성|피싱|탈취|漏えい|漏洩|不正アクセス|脆弱性|ランサム|攻撃|ransomware|breach|vulnerab|hack|exploit|attack|malware|CVE-/i;

/** 걸러야 하면 걸린 단어를, 아니면 null을 돌려준다. */
export function keywordExclusion(title: string): string | null {
  if (INCIDENT.test(title)) return null;
  for (const p of PATTERNS) {
    const m = title.match(p);
    if (m) return m[0];
  }
  return null;
}
