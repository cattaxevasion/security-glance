// 수집 진입점.
//   npm run collect              뉴스 + 취약점 전부
//   npm run collect -- news      뉴스만
//   npm run collect -- vulns     취약점만
//   --limit N                    이번 실행에서 요약할 새 기사 최대 개수 (기본 80)
//   --dry                        요약 결과를 출력만 하고 저장하지 않음
import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";
import type { Meta, NewsItem, RunStats, VulnData } from "../../shared/types";
import { extractArticle } from "./article";
import { fetchFeeds, type RawItem, type Source } from "./rss";
import { SummaryRefused, summarize } from "./summarize";
import { idFor, mapLimit, readJson, writeJson } from "./util";
import { collectVulns } from "./vulns";

const NEWS_PATH = "public/data/news.json";
const VULNS_PATH = "public/data/vulns.json";
const META_PATH = "public/data/meta.json";
/** 공개하지 않는 내부 상태: 보안 무관 판정, 실패 횟수 */
const STATE_PATH = "data/state.json";

const RETENTION_DAYS = 90;
const MAX_FAILURES = 3;
const CONCURRENCY = 4;

interface State {
  /** 보안 무관으로 판정된 기사 id → 판정 시각. 다시 요약하지 않는다. */
  notSecurity: Record<string, string>;
  /** 요약 실패 횟수. MAX_FAILURES 이상이면 포기한다. */
  failures: Record<string, number>;
}

const args = process.argv.slice(2);
const mode = args.find((a) => a === "news" || a === "vulns") ?? "all";
const dry = args.includes("--dry");
const limitArg = args.indexOf("--limit");
const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : Number(process.env.MAX_NEW_PER_RUN ?? 80);

const cutoff = Date.now() - RETENTION_DAYS * 86400_000;

async function runNews(meta: Meta): Promise<NewsItem[]> {
  const { sources } = JSON.parse(await readFile("sources.json", "utf8")) as { sources: Source[] };
  const existing = await readJson<NewsItem[]>(NEWS_PATH, []);
  const state = await readJson<State>(STATE_PATH, { notSecurity: {}, failures: {} });

  const { items, statuses } = await fetchFeeds(sources);
  meta.sources = statuses;
  for (const s of statuses) console.log(`${s.ok ? "OK  " : "FAIL"} ${s.name.padEnd(22)} ${s.ok ? s.items : s.error}`);

  const known = new Set([
    ...existing.map((n) => n.id),
    ...Object.keys(state.notSecurity),
    ...Object.entries(state.failures)
      .filter(([, n]) => n >= MAX_FAILURES)
      .map(([id]) => id),
  ]);

  const candidates = new Map<string, RawItem>();
  for (const item of items) {
    const id = idFor(item.url);
    if (known.has(id) || candidates.has(id)) continue;
    if (Date.parse(item.publishedAt) < cutoff) continue;
    candidates.set(id, item);
  }
  // 최신 기사부터 처리하고, 한도를 넘는 건 다음 실행으로 미룬다
  const queue = [...candidates.entries()].sort((a, b) => b[1].publishedAt.localeCompare(a[1].publishedAt));
  // 키가 없으면 요약을 건너뛰고 다음 실행으로 미룬다 (취약점 수집은 계속)
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  if (!hasKey) console.warn("\nANTHROPIC_API_KEY가 없어 기사 요약을 건너뜁니다.");
  const batch = hasKey ? queue.slice(0, limit) : [];
  console.log(`\n새 기사 ${queue.length}건 중 ${batch.length}건 요약 시작 (모델 ${process.env.SUMMARY_MODEL ?? "claude-haiku-5-5"})`);

  const stats: RunStats = { candidates: queue.length, added: 0, notSecurity: 0, failed: 0, deferred: queue.length - batch.length };
  const added: NewsItem[] = [];
  let configFailed = false;

  await mapLimit(batch, CONCURRENCY, async ([id, raw]) => {
    if (configFailed) return;
    try {
      const body = await extractArticle(raw.url);
      const item = await summarize(raw, body);
      if (!item) {
        state.notSecurity[id] = new Date().toISOString();
        stats.notSecurity++;
        console.log(`  -  [무관] ${raw.title.slice(0, 60)}`);
        return;
      }
      item.id = id;
      added.push(item);
      delete state.failures[id];
      stats.added++;
      console.log(`  +  [${item.basis}] ${item.titleKo.slice(0, 60)}`);
      if (dry) console.log(JSON.stringify(item, null, 2));
    } catch (e) {
      // 키·권한·요청 형식 문제는 기사 탓이 아니므로 실패로 세지 않고 이번 실행의 요약을 멈춘다
      if (
        e instanceof Anthropic.AuthenticationError ||
        e instanceof Anthropic.PermissionDeniedError ||
        e instanceof Anthropic.BadRequestError
      ) {
        if (!configFailed) console.error(`Anthropic 설정 오류로 요약을 중단합니다: ${e.message}`);
        configFailed = true;
        return;
      }
      state.failures[id] = (state.failures[id] ?? 0) + 1;
      stats.failed++;
      const why = e instanceof SummaryRefused ? `거절(${e.message})` : (e as Error).message;
      console.warn(`  !  ${raw.title.slice(0, 60)} → ${why}`);
    }
  });

  meta.lastRun = stats;
  console.log(`\n추가 ${stats.added} · 무관 ${stats.notSecurity} · 실패 ${stats.failed} · 다음으로 미룸 ${stats.deferred}`);

  const merged = [...added, ...existing]
    .filter((n) => Date.parse(n.publishedAt) >= cutoff)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  // 오래된 내부 상태 정리 (피드에서 이미 사라졌을 기사)
  for (const [id, at] of Object.entries(state.notSecurity)) if (Date.parse(at) < cutoff) delete state.notSecurity[id];

  if (!dry) {
    await writeJson(NEWS_PATH, merged);
    await writeJson(STATE_PATH, state);
  }
  return merged;
}

async function main() {
  const meta = await readJson<Meta>(META_PATH, {
    updatedAt: "",
    lastRun: null,
    newsCount: 0,
    kevCount: 0,
    cveCount: 0,
    sources: [],
  });

  let news = await readJson<NewsItem[]>(NEWS_PATH, []);
  if (mode !== "vulns") news = await runNews(meta);

  if (mode !== "news") {
    const mentionedCves = [...new Set(news.flatMap((n) => n.entities.cves))];
    const vulns: VulnData = await collectVulns(mentionedCves);
    console.log(`KEV ${vulns.kev.length}건 · 고위험 CVE ${vulns.cves.length}건 · 기사 속 CVE EPSS ${Object.keys(vulns.mentioned).length}건`);
    meta.kevCount = vulns.kev.length;
    meta.cveCount = vulns.cves.length;
    if (!dry) await writeJson(VULNS_PATH, vulns);
  }

  meta.newsCount = news.length;
  meta.updatedAt = new Date().toISOString();
  if (!dry) await writeJson(META_PATH, meta);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
