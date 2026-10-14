// 화면 글자와 태그 라벨 번역표. 데이터의 태그 값은 한국어로 고정이고, 표시할 때만 바꾼다.
import type { AttackType, Nature, Region, Sector } from "../shared/taxonomy";

export type Lang = "ko" | "ja";

const ko = {
  appName: "Security Glance",
  search: "제목, 요약, CVE, 그룹명 검색",
  navArticles: "기사",
  navAll: "전체",
  navVulns: "취약점",
  navKev: "실제 악용 (KEV)",
  navCve: "고위험 CVE",
  navStatus: "수집 상태",
  expandNav: "탐색 펼치기",
  collapseNav: "탐색 접기",
  language: "언어",
  updated: (t: string) => `${t} 갱신`,
  lastCollected: "마지막 수집",
  sourceFailed: "읽지 못함",
  overview: "최근 동향",
  kpiToday: "최근 24시간 기사",
  kpiTodaySub: "전체 지역",
  kpiRansom: "랜섬웨어 기사",
  kpiRansomSub: "최근 7일",
  kpiKev: "KEV 신규 등록",
  kpiKevSub: "최근 7일",
  kpiCritical: "CVSS 9.0 이상 신규",
  kpiCriticalSub: "최근 14일",
  period: "기간",
  periods: { 1: "24시간", 3: "3일", 7: "1주", 30: "30일", 0: "전체" } as Record<number, string>,
  count: (n: number) => `${n.toLocaleString()}건`,
  filterAttack: "공격 유형",
  filterSector: "산업",
  filterNature: "성격",
  any: "전체",
  resetAll: "모두 초기화",
  colTime: "시간",
  colRegion: "지역",
  colTitle: "제목",
  colNature: "성격",
  colSource: "출처",
  today: "오늘",
  yesterday: "어제",
  empty: "조건에 맞는 기사가 없어요.",
  emptyHint: "필터를 줄이거나 기간을 늘려 보세요.",
  noData: "아직 수집된 기사가 없어요.",
  more: (n: number) => `더 보기 (${n.toLocaleString()}건 남음)`,
  loading: "불러오는 중",
  // 상세 패널
  prevItem: "이전 항목",
  nextItem: "다음 항목",
  close: "닫기",
  openArticle: "원문 기사 열기",
  copyLink: "링크 복사",
  refresh: "새로고침",
  copied: "복사했어요",
  summary: "요약",
  classification: "분류",
  entities: "관련 정보",
  details: "상세 정보",
  attackTypes: "공격 유형",
  sectors: "대상 산업",
  cves: "CVE",
  actors: "위협 그룹",
  orgs: "조직·제품",
  none: "없음",
  source: "출처",
  published: "게시 시각",
  basis: "요약 근거",
  basisLabel: { 본문: "기사 본문", 요지: "RSS 요지 (본문 확인 필요)", 제목: "제목만 (본문 확인 필요)" } as Record<string, string>,
  originalTitle: "원제목",
  regions: "지역",
  aiNotice: "요약과 분류는 AI가 만들었어요. 중요한 내용은 원문을 확인하세요.",
  epssTip: (p: string, top: string) => `30일 안에 악용될 확률 ${p} · 상위 ${top}`,
  // 취약점
  kevTitle: "실제 악용 중인 취약점",
  kevDesc: "CISA가 실제 공격에 쓰인 것을 확인한 취약점이에요. 패치 우선순위를 정할 때 가장 먼저 봐요. 최근 90일.",
  cveTitle: "고위험 신규 CVE",
  cveDesc: "최근 14일 동안 공개된 CVSS 7.0 이상 취약점이에요. CVSS는 심각도, EPSS는 실제로 악용될 가능성이에요.",
  vulnSearch: "CVE, 벤더, 제품 검색",
  colAdded: "등록일",
  colCve: "CVE",
  colVendor: "벤더 · 제품",
  colVuln: "취약점",
  colEpss: "EPSS",
  colDue: "조치 기한",
  colPublished: "공개일",
  colCvss: "CVSS",
  colDesc: "설명",
  colNews: "관련 기사",
  ransomware: "랜섬웨어 악용",
  inKev: "KEV 등록",
  relatedNews: "관련 기사",
  noRelated: "이 CVE를 다룬 기사가 아직 없어요.",
  description: "설명",
  requiredAction: "권고 조치",
  openNvd: "NVD에서 보기",
  footer: "기사 저작권은 각 언론사와 기관에 있어요. 이 사이트는 제목, 링크, AI 요약만 보여줘요. 취약점 데이터: CISA KEV, NVD, FIRST EPSS.",
  sourcesFailed: (names: string) => `이번 수집에서 ${names} 소스를 읽지 못했어요.`,
};

export type Strings = typeof ko;

const ja: Strings = {
  appName: "Security Glance",
  search: "タイトル、要約、CVE、グループ名で検索",
  navArticles: "記事",
  navAll: "すべて",
  navVulns: "脆弱性",
  navKev: "悪用確認済み (KEV)",
  navCve: "高リスク CVE",
  navStatus: "収集状況",
  expandNav: "ナビゲーションを展開",
  collapseNav: "ナビゲーションを折りたたむ",
  language: "言語",
  updated: (t: string) => `${t}に更新`,
  lastCollected: "最終収集",
  sourceFailed: "取得失敗",
  overview: "最近の動向",
  kpiToday: "直近24時間の記事",
  kpiTodaySub: "全地域",
  kpiRansom: "ランサムウェア記事",
  kpiRansomSub: "直近7日",
  kpiKev: "KEV 新規登録",
  kpiKevSub: "直近7日",
  kpiCritical: "CVSS 9.0 以上の新規",
  kpiCriticalSub: "直近14日",
  period: "期間",
  periods: { 1: "24時間", 3: "3日", 7: "1週間", 30: "30日", 0: "すべて" },
  count: (n: number) => `${n.toLocaleString()}件`,
  filterAttack: "攻撃種別",
  filterSector: "業種",
  filterNature: "性質",
  any: "すべて",
  resetAll: "すべてリセット",
  colTime: "時刻",
  colRegion: "地域",
  colTitle: "タイトル",
  colNature: "性質",
  colSource: "出典",
  today: "今日",
  yesterday: "昨日",
  empty: "条件に合う記事はありません。",
  emptyHint: "フィルターを減らすか、期間を広げてください。",
  noData: "まだ収集された記事がありません。",
  more: (n: number) => `さらに表示 (残り${n.toLocaleString()}件)`,
  loading: "読み込み中",
  prevItem: "前の項目",
  nextItem: "次の項目",
  close: "閉じる",
  openArticle: "元記事を開く",
  copyLink: "リンクをコピー",
  refresh: "更新",
  copied: "コピーしました",
  summary: "要約",
  classification: "分類",
  entities: "関連情報",
  details: "詳細",
  attackTypes: "攻撃種別",
  sectors: "対象業種",
  cves: "CVE",
  actors: "脅威グループ",
  orgs: "組織・製品",
  none: "なし",
  source: "出典",
  published: "公開日時",
  basis: "要約の根拠",
  basisLabel: { 본문: "記事本文", 요지: "RSS 概要 (本文の確認を推奨)", 제목: "タイトルのみ (本文の確認を推奨)" },
  originalTitle: "原題",
  regions: "地域",
  aiNotice: "要約と分類は AI が作成しました。重要な内容は元記事を確認してください。",
  epssTip: (p: string, top: string) => `30日以内に悪用される確率 ${p} · 上位 ${top}`,
  kevTitle: "悪用が確認された脆弱性",
  kevDesc: "CISA が実際の攻撃での悪用を確認した脆弱性です。パッチの優先順位を決めるときに最初に見る指標です。直近90日。",
  cveTitle: "高リスクの新規 CVE",
  cveDesc: "直近14日に公開された CVSS 7.0 以上の脆弱性です。CVSS は深刻度、EPSS は実際に悪用される可能性を示します。",
  vulnSearch: "CVE、ベンダー、製品で検索",
  colAdded: "登録日",
  colCve: "CVE",
  colVendor: "ベンダー · 製品",
  colVuln: "脆弱性",
  colEpss: "EPSS",
  colDue: "対応期限",
  colPublished: "公開日",
  colCvss: "CVSS",
  colDesc: "説明",
  colNews: "関連記事",
  ransomware: "ランサムウェアで悪用",
  inKev: "KEV 登録",
  relatedNews: "関連記事",
  noRelated: "この CVE を扱った記事はまだありません。",
  description: "説明",
  requiredAction: "推奨対応",
  openNvd: "NVD で見る",
  footer: "記事の著作権は各報道機関・組織に帰属します。本サイトはタイトル、リンク、AI 要約のみを表示します。脆弱性データ: CISA KEV、NVD、FIRST EPSS。",
  sourcesFailed: (names: string) => `今回の収集で ${names} を取得できませんでした。`,
};

export const STRINGS: Record<Lang, Strings> = { ko, ja };

export const REGION_LABELS: Record<Lang, Record<Region, string>> = {
  ko: { INTL: "국제", JP: "일본", KR: "한국" },
  ja: { INTL: "国際", JP: "日本", KR: "韓国" },
};

const ATTACK_JA: Record<AttackType, string> = {
  랜섬웨어: "ランサムウェア",
  피싱: "フィッシング",
  정보유출: "情報漏えい",
  "취약점 악용": "脆弱性の悪用",
  제로데이: "ゼロデイ",
  공급망: "サプライチェーン",
  DDoS: "DDoS",
  "계정 탈취": "アカウント乗っ取り",
  내부자: "内部不正",
  악성코드: "マルウェア",
};

const SECTOR_JA: Record<Sector, string> = {
  "정부·공공": "政府・公共",
  금융: "金融",
  의료: "医療",
  제조: "製造",
  통신: "通信",
  교육: "教育",
  "IT·클라우드": "IT・クラウド",
  "유통·서비스": "流通・サービス",
  "에너지·기반시설": "エネルギー・重要インフラ",
  개인: "個人",
};

const NATURE_JA: Record<Nature, string> = {
  사건: "インシデント",
  "취약점 공지": "脆弱性情報",
  "정책·법규": "政策・法規制",
  "체포·수사": "捜査・逮捕",
  "연구·리포트": "調査・レポート",
  "업계 동향": "業界動向",
};

/** 태그 값(한국어)을 화면 언어로 */
export function tagLabel(lang: Lang, value: string): string {
  if (lang === "ko") return value;
  return (
    (ATTACK_JA as Record<string, string>)[value] ??
    (SECTOR_JA as Record<string, string>)[value] ??
    (NATURE_JA as Record<string, string>)[value] ??
    value
  );
}

export const LOCALE: Record<Lang, string> = { ko: "ko-KR", ja: "ja-JP" };

// 한글·일본어는 Pretendard(가변 글꼴, 필요한 글자만 내려받는 분할 버전)로 읽기 좋게 맞춘다.
export const FONT_STACK: Record<Lang, string> = {
  ko: `"Pretendard Variable", "Pretendard JP Variable", "Segoe UI Variable Text", "Segoe UI", "Malgun Gothic", "Apple SD Gothic Neo", system-ui, sans-serif`,
  ja: `"Pretendard JP Variable", "Pretendard Variable", "Segoe UI Variable Text", "Segoe UI", "Yu Gothic UI", "Hiragino Sans", system-ui, sans-serif`,
};

export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem("sg-lang");
    if (saved === "ko" || saved === "ja") return saved;
  } catch {
    // 저장소를 못 쓰는 환경이면 브라우저 언어로
  }
  return navigator.language.toLowerCase().startsWith("ja") ? "ja" : "ko";
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem("sg-lang", lang);
  } catch {
    // 무시
  }
}
