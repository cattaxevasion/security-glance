import Parser from "rss-parser";
import type { Region, SourceKind } from "../../shared/taxonomy";
import type { SourceStatus } from "../../shared/types";
import { cleanText, fetchText, normalizeUrl } from "./util";

export interface Source {
  id: string;
  name: string;
  region: Region;
  lang: "en" | "ja" | "ko";
  kind: SourceKind;
  url: string;
  keywordFilter?: boolean;
}

export interface RawItem {
  url: string;
  title: string;
  snippet: string;
  publishedAt: string;
  source: Source;
}

// 일반 IT 매체(keywordFilter)에서 보안 기사만 남기는 키워드
const SECURITY_KEYWORDS =
  /보안|해킹|해커|랜섬|취약점|유출|개인정보|사이버|악성|피싱|침해|디도스|DDoS|CVE-|제로데이|스미싱|탈취|위협|공격/i;

const parser = new Parser();

// 시간대 표시가 없는 날짜(예: 데일리시큐 "2026-10-14 19:08:29")는 출처 지역의 현지 시각으로 본다.
// 그대로 Date에 넘기면 수집 서버(UTC) 기준으로 해석돼 한국·일본 기사가 9시간 미래로 저장된다.
const LOCAL_OFFSET: Record<Region, string> = { JP: "+09:00", INTL: "Z" };
const NAIVE = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)$/;

function parseDate(raw: string | undefined, source: Source): string {
  const now = Date.now();
  if (!raw) return new Date(now).toISOString();
  const m = raw.trim().match(NAIVE);
  const t = m ? Date.parse(`${m[1]}T${m[2]}${LOCAL_OFFSET[source.region]}`) : Date.parse(raw);
  if (isNaN(t)) return new Date(now).toISOString();
  // 피드 시계가 틀려 미래 시각이 오면 지금으로 자른다
  return new Date(Math.min(t, now)).toISOString();
}

export async function fetchFeeds(sources: Source[]): Promise<{ items: RawItem[]; statuses: SourceStatus[] }> {
  const items: RawItem[] = [];
  const statuses: SourceStatus[] = [];

  await Promise.all(
    sources.map(async (source) => {
      try {
        const xml = await fetchText(source.url);
        const feed = await parser.parseString(xml);
        let count = 0;
        for (const entry of feed.items) {
          const url = entry.link ? normalizeUrl(entry.link) : "";
          const title = cleanText(entry.title);
          if (!url || !title) continue;
          const snippet = cleanText(entry.contentSnippet ?? entry.summary ?? "").slice(0, 1500);
          if (source.keywordFilter && !SECURITY_KEYWORDS.test(`${title} ${snippet}`)) continue;
          items.push({ url, title, snippet, publishedAt: parseDate(entry.pubDate ?? entry.isoDate, source), source });
          count++;
        }
        statuses.push({ id: source.id, name: source.name, region: source.region, ok: true, items: count });
      } catch (e) {
        statuses.push({
          id: source.id,
          name: source.name,
          region: source.region,
          ok: false,
          items: 0,
          error: (e as Error).message.slice(0, 200),
        });
      }
    }),
  );

  statuses.sort((a, b) => sources.findIndex((s) => s.id === a.id) - sources.findIndex((s) => s.id === b.id));
  return { items, statuses };
}
