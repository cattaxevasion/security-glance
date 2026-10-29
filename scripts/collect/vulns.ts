// CISA KEV + NVD 고위험 CVE + FIRST EPSS
import type { CveEntry, KevEntry, VulnData } from "../../shared/types";
import { fetchJson, sleep } from "./util";

const KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
const NVD_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0";
const EPSS_URL = "https://api.first.org/data/v1/epss";

const KEV_DAYS = 90;
const NVD_DAYS = 14;

interface KevFeed {
  vulnerabilities: {
    cveID: string;
    vendorProject: string;
    product: string;
    vulnerabilityName: string;
    dateAdded: string;
    shortDescription: string;
    requiredAction: string;
    dueDate: string;
    knownRansomwareCampaignUse: string;
  }[];
}

async function fetchKev(): Promise<KevEntry[]> {
  const feed = await fetchJson<KevFeed>(KEV_URL);
  const cutoff = Date.now() - KEV_DAYS * 86400_000;
  return feed.vulnerabilities
    .filter((v) => Date.parse(v.dateAdded) >= cutoff)
    .map((v) => ({
      cveID: v.cveID,
      vendorProject: v.vendorProject,
      product: v.product,
      vulnerabilityName: v.vulnerabilityName,
      dateAdded: v.dateAdded,
      shortDescription: v.shortDescription,
      requiredAction: v.requiredAction,
      dueDate: v.dueDate,
      ransomware: v.knownRansomwareCampaignUse === "Known",
      epss: null,
      epssPercentile: null,
    }))
    .sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));
}

interface NvdCvssMetric {
  cvssData: { baseScore: number; baseSeverity?: string };
  baseSeverity?: string;
}

interface NvdResponse {
  vulnerabilities: {
    cve: {
      id: string;
      published: string;
      descriptions: { lang: string; value: string }[];
      metrics?: Record<string, NvdCvssMetric[] | undefined>;
    };
  }[];
}

const severityOf = (m: NvdCvssMetric) => m.cvssData.baseSeverity ?? m.baseSeverity ?? null;

/** want: NVD에 물어본 등급. 한 CVE에 NVD·제보 기관 점수가 함께 있으면 그 등급으로 걸린 점수를 고른다 */
export function pickCvss(metrics: Record<string, NvdCvssMetric[] | undefined> | undefined, want?: string) {
  // v3.1을 먼저: NVD에서 v3 기준 HIGH·CRITICAL로 고른 목록이라 v4 점수를 보여주면 MEDIUM·LOW가 섞여 보인다
  for (const key of ["cvssMetricV31", "cvssMetricV30", "cvssMetricV40"]) {
    const list = metrics?.[key] ?? [];
    const m = list.find((x) => severityOf(x) === want) ?? list[0];
    if (m) return { score: m.cvssData.baseScore, severity: severityOf(m) };
  }
  return { score: null, severity: null };
}

async function fetchNvd(): Promise<CveEntry[]> {
  const end = new Date();
  const start = new Date(end.getTime() - NVD_DAYS * 86400_000);
  const headers: Record<string, string> = {};
  if (process.env.NVD_API_KEY) headers.apiKey = process.env.NVD_API_KEY;

  const out: CveEntry[] = [];
  for (const severity of ["CRITICAL", "HIGH"]) {
    const params = new URLSearchParams({
      pubStartDate: start.toISOString(),
      pubEndDate: end.toISOString(),
      cvssV3Severity: severity,
      resultsPerPage: "2000",
    });
    const data = await fetchJson<NvdResponse>(`${NVD_URL}?${params}`, { headers }, 90000);
    for (const { cve } of data.vulnerabilities) {
      const { score, severity: sev } = pickCvss(cve.metrics, severity);
      out.push({
        id: cve.id,
        published: cve.published,
        description: cve.descriptions.find((d) => d.lang === "en")?.value ?? "",
        cvss: score,
        severity: sev,
        epss: null,
        epssPercentile: null,
        inKev: false,
      });
    }
    // 키 없이 쓰면 30초에 5회 제한이라 간격을 둔다
    if (!process.env.NVD_API_KEY) await sleep(6500);
  }
  const seen = new Set<string>();
  return out.filter((c) => !seen.has(c.id) && seen.add(c.id));
}

async function fetchEpss(cves: string[]): Promise<Map<string, { epss: number; percentile: number }>> {
  const result = new Map<string, { epss: number; percentile: number }>();
  const unique = [...new Set(cves)];
  for (let i = 0; i < unique.length; i += 80) {
    const batch = unique.slice(i, i + 80);
    const data = await fetchJson<{ data: { cve: string; epss: string; percentile: string }[] }>(
      `${EPSS_URL}?cve=${batch.join(",")}`,
    );
    for (const d of data.data) result.set(d.cve, { epss: Number(d.epss), percentile: Number(d.percentile) });
  }
  return result;
}

/** 한 번 실패하면 잠시 뒤 한 번 더 (NVD·CISA는 가끔 503을 낸다) */
async function retryOnce<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.warn(`${label} 실패, 20초 뒤 다시 시도: ${(e as Error).message.slice(0, 160)}`);
    await sleep(20000);
    return fn();
  }
}

/**
 * extraCves: 기사에서 나온 CVE. EPSS만 조회해서 mentioned에 담는다.
 * prev: 지난 실행의 결과. 어느 출처가 끝내 실패하면 그 부분은 지난 결과를 그대로 쓴다 (빈 목록으로 덮어쓰지 않게).
 */
export async function collectVulns(extraCves: string[], prev: VulnData | null): Promise<VulnData> {
  let kev: KevEntry[];
  try {
    kev = await retryOnce("CISA KEV 수집", fetchKev);
  } catch (e) {
    if (!prev) throw e;
    console.warn(`CISA KEV 수집 실패 → 지난 결과 ${prev.kev.length}건 유지: ${(e as Error).message.slice(0, 120)}`);
    kev = prev.kev;
  }
  let cves: CveEntry[] = [];
  try {
    cves = await retryOnce("NVD 수집", fetchNvd);
  } catch (e) {
    // 지난 결과 가운데 아직 기간 안의 것만
    const cutoff = Date.now() - NVD_DAYS * 86400_000;
    cves = (prev?.cves ?? []).filter((c) => Date.parse(c.published) >= cutoff);
    console.warn(`NVD 수집 실패 → 지난 결과 ${cves.length}건 유지: ${(e as Error).message.slice(0, 120)}`);
  }

  const kevIds = new Set(kev.map((k) => k.cveID));
  for (const c of cves) c.inKev = kevIds.has(c.id);

  const mentioned: VulnData["mentioned"] = {};
  try {
    const epss = await fetchEpss([...kev.map((k) => k.cveID), ...cves.map((c) => c.id), ...extraCves]);
    for (const k of kev) {
      const e = epss.get(k.cveID);
      if (e) [k.epss, k.epssPercentile] = [e.epss, e.percentile];
    }
    for (const c of cves) {
      const e = epss.get(c.id);
      if (e) [c.epss, c.epssPercentile] = [e.epss, e.percentile];
    }
    for (const id of extraCves) {
      const e = epss.get(id);
      if (e) mentioned[id] = e;
    }
  } catch (e) {
    console.warn(`EPSS 수집 실패 → 지난 값 유지: ${(e as Error).message}`);
    Object.assign(mentioned, prev?.mentioned ?? {});
  }

  cves.sort((a, b) => (b.cvss ?? 0) - (a.cvss ?? 0) || b.published.localeCompare(a.published));
  return { kev, cves, mentioned };
}
