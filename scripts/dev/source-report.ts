// 소스별 수집 현황 분석 (개발용, 읽기 전용): 피드의 최근 90일 글이 추가/제외/대기 중 어디로 갔는지,
// 본문을 못 읽고 제목·요지로만 요약한 기사가 어느 소스에서 왜 생겼는지.
import { readFile } from "node:fs/promises";
import robotsParser from "robots-parser";
import type { NewsItem } from "../../shared/types";
import { BODY_CHARS, extractArticle } from "../collect/article";
import { fetchFeeds, type Source } from "../collect/rss";
import { USER_AGENT, fetchText, idFor } from "../collect/util";

const { sources } = JSON.parse(await readFile("sources.json", "utf8")) as { sources: Source[] };
const news = JSON.parse(await readFile("public/data/news.json", "utf8")) as NewsItem[];
const state = JSON.parse(await readFile("data/state.json", "utf8")) as { excluded: Record<string, string> };
const added = new Set(news.map((n) => n.id));
const cutoff = Date.now() - 90 * 86400_000;

const { items } = await fetchFeeds(sources);
const rows: Record<string, { feed: number; added: number; excluded: number; other: number }> = {};
for (const it of items) {
  if (Date.parse(it.publishedAt) < cutoff) continue;
  const r = (rows[it.source.name] ??= { feed: 0, added: 0, excluded: 0, other: 0 });
  const id = idFor(it.url);
  r.feed++;
  if (added.has(id)) r.added++;
  else if (state.excluded[id]) r.excluded++;
  else r.other++;
}
console.log("소스별 (최근 90일 피드 기준): 추가 / 제외 / 미처리 · 제외율");
for (const [name, r] of Object.entries(rows).sort((a, b) => b[1].excluded / b[1].feed - a[1].excluded / a[1].feed)) {
  const kind = sources.find((s) => s.name === name)?.kind;
  console.log(`  ${name.padEnd(30)} ${kind?.padEnd(6)} ${String(r.added).padStart(3)} / ${String(r.excluded).padStart(3)} / ${String(r.other).padStart(3)} · ${Math.round((r.excluded / Math.max(1, r.added + r.excluded)) * 100)}%`);
}

console.log("\n본문을 못 읽은 기사 (제목·요지 기반):");
const weak = news.filter((n) => n.basis !== "본문");
const bySrc: Record<string, NewsItem[]> = {};
for (const n of weak) (bySrc[n.sourceName] ??= []).push(n);
for (const [name, list] of Object.entries(bySrc)) {
  const total = news.filter((n) => n.sourceName === name).length;
  // 원인 진단: robots.txt 차단 / 요청 실패 / 본문이 너무 짧음(유료·로그인 벽)
  const n = list[0];
  const origin = new URL(n.url).origin;
  let reason = "";
  try {
    const robots = robotsParser(`${origin}/robots.txt`, await fetchText(`${origin}/robots.txt`, 10000));
    if (robots.isAllowed(n.url, USER_AGENT) === false) reason = "robots.txt 차단";
  } catch {
    // robots.txt 없음
  }
  if (!reason) {
    try {
      const html = await fetchText(n.url, 20000);
      const body = await extractArticle(n.url, BODY_CHARS.news);
      reason = body ? "지금은 읽힘 (일시적 실패)" : `본문 추출 실패 (HTML ${html.length}자: 유료·로그인 벽 또는 스크립트 렌더링)`;
    } catch (e) {
      reason = `요청 실패: ${(e as Error).message}`;
    }
  }
  console.log(`  ${name}: ${list.length}/${total}건 · ${reason}`);
  for (const x of list.slice(0, 3)) console.log(`     - [${x.basis}] ${x.title.slice(0, 70)}`);
}
