import type { AttackType, IocType, Nature, Region, Sector, SourceKind } from "./taxonomy";

/** 요약에 쓴 근거. 본문을 못 읽으면 RSS 요지, 그것도 없으면 제목만. */
export type Basis = "본문" | "요지" | "제목";

export interface NewsItem {
  id: string;
  url: string;
  title: string;
  /** 원문이 한국어면 원제목, 아니면 번역한 제목. */
  titleKo: string;
  /** 원문이 일본어면 원제목, 아니면 번역한 제목. 이전 데이터는 채워지기 전까지 비어 있을 수 있다. */
  titleJa: string;
  sourceId: string;
  sourceName: string;
  sourceRegion: Region;
  /** 뉴스 매체, 보안 벤더 리서치, CERT·공공기관 */
  sourceKind: SourceKind;
  publishedAt: string;
  collectedAt: string;
  /** 사건 기준 지역. 애매하면 출처 지역. */
  regions: Region[];
  summaryKo: string[];
  summaryJa: string[];
  attackTypes: AttackType[];
  sectors: Sector[];
  nature: Nature;
  entities: { cves: string[]; actors: string[]; orgs: string[] };
  /** 기술 분석이 있는 글에서만: MITRE ATT&CK 기법 */
  techniques: Technique[];
  iocTypes: IocType[];
  basis: Basis;
}

/** 화면(상세 패널의 '흐름')에 필요한 기사 정보만. articles.json으로 따로 내보내 첫 로딩을 가볍게 한다. */
export type ArticleRef = Pick<
  NewsItem,
  "id" | "url" | "title" | "titleKo" | "titleJa" | "sourceName" | "sourceKind" | "publishedAt" | "basis"
>;

export interface Technique {
  /** 예: T1190, T1059.001 */
  id: string;
  name: string;
}

/** 같은 사건·이슈를 다룬 기사 묶음 (まとめ) */
export interface Topic {
  id: string;
  titleKo: string;
  titleJa: string;
  summaryKo: string[];
  summaryJa: string[];
  regions: Region[];
  nature: Nature;
  attackTypes: AttackType[];
  sectors: Sector[];
  entities: { cves: string[]; actors: string[]; orgs: string[] };
  techniques: Technique[];
  iocTypes: IocType[];
  /** 최신 기사 먼저 */
  articleIds: string[];
  sources: string[];
  hasVendor: boolean;
  /** 모든 기사가 본문을 못 읽고 제목·요지로만 요약됐으면 true (중요도를 낮춘다) */
  weak?: boolean;
  firstSeen: string;
  lastUpdated: string;
  /** 이 토픽의 기사가 마지막으로 수집된 시각 (지난 방문 이후 새 소식 판단용) */
  collectedAt?: string;
  /** 시간 감쇠 전 중요도 (0~100 남짓). 화면에서 최신성을 곱해 정렬한다. */
  importance: number;
  /** 통합 요약을 만들 때의 기사 수. 기사가 늘면 다시 만든다. */
  summarizedCount: number;
}

export interface BriefingItem {
  topicId: string;
  titleKo: string;
  titleJa: string;
  bodyKo: string;
  bodyJa: string;
  whyKo: string;
  whyJa: string;
}

/** 오늘의 브리핑 (일본 시간 기준 하루 한 번) */
export interface Briefing {
  date: string;
  generatedAt: string;
  headlineKo: string;
  headlineJa: string;
  items: BriefingItem[];
}

export interface KevEntry {
  cveID: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  dateAdded: string;
  shortDescription: string;
  requiredAction: string;
  dueDate: string;
  ransomware: boolean;
  epss: number | null;
  epssPercentile: number | null;
}

export interface CveEntry {
  id: string;
  published: string;
  description: string;
  cvss: number | null;
  severity: string | null;
  epss: number | null;
  epssPercentile: number | null;
  inKev: boolean;
}

export interface VulnData {
  kev: KevEntry[];
  cves: CveEntry[];
  /** 기사에 나온 CVE의 EPSS. 카드의 CVE 칩에 표시한다. */
  mentioned: Record<string, { epss: number; percentile: number }>;
}

export interface SourceStatus {
  id: string;
  name: string;
  region: Region;
  ok: boolean;
  items: number;
  error?: string;
}

export interface RunStats {
  candidates: number;
  added: number;
  /** 제목 키워드로 요약 전에 제외 */
  keywordExcluded: number;
  /** LLM이 보안 무관 또는 업계 동향으로 판정해 제외 */
  notSecurity: number;
  failed: number;
  deferred: number;
}

/**
 * 랜섬웨어 조직이 유출 사이트에 올린 피해 주장 (일본 조직, ransomware.live 집계). 사실 확인 전 정보.
 * 유출 사이트 주소와 AI 생성 설명은 저장하지 않는다.
 */
export interface LeakPost {
  id: string;
  /** 게시된 피해 조직 이름 (대개 영문·도메인) */
  victim: string;
  website: string | null;
  /** 랜섬웨어 조직 */
  group: string;
  /** 게시가 처음 확인된 시각 */
  discovered: string;
  sector: Sector | null;
  /** 같은 조직의 피해를 다룬 보도 토픽 */
  topicIds: string[];
  /** 보도 연결을 마지막으로 확인한 시각 */
  checkedAt: string | null;
}

export interface Meta {
  updatedAt: string;
  lastRun: RunStats | null;
  newsCount: number;
  topicCount: number;
  kevCount: number;
  cveCount: number;
  sources: SourceStatus[];
}
