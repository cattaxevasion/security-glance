import type { AttackType, Nature, Region, Sector } from "./taxonomy";

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
  basis: Basis;
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

export interface Meta {
  updatedAt: string;
  lastRun: RunStats | null;
  newsCount: number;
  kevCount: number;
  cveCount: number;
  sources: SourceStatus[];
}
