import Parser from "rss-parser";
import type { Region } from "../../shared/taxonomy";
import type { SourceStatus } from "../../shared/types";
import { cleanText, fetchText, normalizeUrl } from "./util";

export interface Source {
  id: string;
  name: string;
  region: Region;
  lang: "en" | "ja" | "ko";
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
          const date = entry.isoDate ?? entry.pubDate;
          items.push({
            url,
            title,
            snippet,
            publishedAt: date && !isNaN(Date.parse(date)) ? new Date(date).toISOString() : new Date().toISOString(),
            source,
          });
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
