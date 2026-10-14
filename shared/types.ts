import type { AttackType, Nature, Region, Sector } from "./taxonomy";

/** 요약에 쓴 근거. 본문을 못 읽으면 RSS 요지, 그것도 없으면 제목만. */
export type Basis = "본문" | "요지" | "제목";

export interface NewsItem {
  id: string;
  url: string;
  title: string;
  /** 원문이 한국어가 아니면 번역한 제목, 한국어면 원제목과 같다. */
  titleKo: string;
  sourceId: string;
  sourceName: string;
  sourceRegion: Region;
  publishedAt: string;
  collectedAt: string;
  /** 사건 기준 지역. 애매하면 출처 지역. */
  regions: Region[];
  summary: string[];
  socPoint: string | null;
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
