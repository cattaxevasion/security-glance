// 수집 진입점.
//   npm run collect              뉴스 + 취약점 전부
//   npm run collect -- news      뉴스만
//   npm run collect -- vulns     취약점만
//   --limit N                    이번 실행에서 요약할 새 기사 최대 개수 (기본 80)
//   --dry                        요약 결과를 출력만 하고 저장하지 않음
//   --briefing                   오늘의 브리핑을 시각과 상관없이 다시 만든다
import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";
import type { ArticleRef, Briefing, Meta, NewsItem, RunStats, Topic, VulnData } from "../../shared/types";
import { BODY_CHARS, extractArticle } from "./article";
import { maybeBriefing } from "./briefing";
import { auditArticles, auditBriefings, auditTopics } from "./lang-audit";
import { RULES_VERSION, rejudgeResearch, retryWeakBodies } from "./quality";
import { keywordExclusion } from "./filter";
import { fetchFeeds, type RawItem, type Source } from "./rss";
import { EXCLUDED_NATURE, SummaryRefused, summarize, translateToJa } from "./summarize";
import { idFor, mapLimit, readJson, writeJson } from "./util";
import { updateTopics } from "./topics";
import { collectVulns } from "./vulns";

const NEWS_PATH = "public/data/news.json";
const VULNS_PATH = "public/data/vulns.json";
const META_PATH = "public/data/meta.json";
/** 화면용 가벼운 기사 목록 (news.json은 수집기 내부용) */
const ARTICLES_PATH = "public/data/articles.json";
const TOPICS_PATH = "public/data/topics.json";
const BRIEFINGS_PATH = "public/data/briefings.json";
/** 토픽 다시 합치기에서 이미 물어본 토픽 쌍 (다시 묻지 않는다) */
const MERGE_CHECKED_PATH = "data/merge-checked.json";
/** 공개하지 않는 내부 상태: 제외 판정, 실패 횟수 */
const STATE_PATH = "data/state.json";

const RETENTION_DAYS = 90;
const MAX_FAILURES = 3;
const CONCURRENCY = 4;
/** 일본어가 비어 있는 기존 기사를 한 번에 몇 건씩 번역할지 */
const TRANSLATE_BATCH = 10;

interface State {
  /** 제외된 기사 id → 판정 시각 (키워드, 보안 무관, 업계 동향). 다시 요약하지 않는다. */
  excluded: Record<string, string>;
  /** 요약 실패 횟수. MAX_FAILURES 이상이면 포기한다. */
  failures: Record<string, number>;
  /** 기사 id → 판정한 기준 판 (quality.ts) */
  rejudged: Record<string, number>;
  /** 기사 id → 본문 다시 읽기 시도 횟수 (quality.ts) */
  bodyRetries: Record<string, number>;
}

type LegacyNewsItem = Omit<NewsItem, "sourceRegion" | "regions"> & {
  sourceRegion: string;
  regions: string[];
  summary?: string[];
  socPoint?: string | null;
};

/**
 * 이전 형식을 지금 형식으로 바꾼다.
 * - summary/socPoint → summaryKo (SOC 포인트 삭제)
 * - 업계 동향 기사 삭제
 * - 한국 범위 제외(2026-10-15): 한국 매체 기사 삭제, 지역에서 KR 제거
 * - sourceKind, techniques, iocTypes 기본값
 */
function migrate(items: LegacyNewsItem[], sources: Source[]): NewsItem[] {
  const dropped = { nature: 0, korea: 0 };
  const out: NewsItem[] = [];
  for (const { summary, socPoint: _socPoint, ...n } of items) {
    if (n.nature === EXCLUDED_NATURE) {
      dropped.nature++;
      continue;
    }
    if (n.sourceRegion === "KR") {
      dropped.korea++;
      continue;
    }
    const regions = n.regions.filter((r): r is NewsItem["regions"][number] => r === "INTL" || r === "JP");
    out.push({
      ...n,
      sourceRegion: n.sourceRegion as NewsItem["sourceRegion"],
      sourceKind: n.sourceKind ?? sources.find((s) => s.id === n.sourceId)?.kind ?? "news",
      regions: regions.length ? regions : ["INTL"],
      summaryKo: n.summaryKo ?? summary ?? [],
      summaryJa: n.summaryJa ?? [],
      titleJa: n.titleJa ?? "",
      techniques: n.techniques ?? [],
      iocTypes: n.iocTypes ?? [],
    });
  }
  if (dropped.nature) console.log(`기존 업계 동향 기사 ${dropped.nature}건 삭제`);
  if (dropped.korea) console.log(`한국 매체 기사 ${dropped.korea}건 삭제`);
  return out;
}

/** 키·권한·요청 형식 문제는 기사 탓이 아니므로 실패로 세지 않고 이번 실행의 요약을 멈춘다. */
function isConfigError(e: unknown): e is Error {
  return (
    e instanceof Anthropic.AuthenticationError ||
    e instanceof Anthropic.PermissionDeniedError ||
    e instanceof Anthropic.BadRequestError
  );
}

const args = process.argv.slice(2);
const mode = args.find((a) => a === "news" || a === "vulns") ?? "all";
const dry = args.includes("--dry");
const forceBriefing = args.includes("--briefing");
const limitArg = args.indexOf("--limit");
const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : Number(process.env.MAX_NEW_PER_RUN ?? 80);

const cutoff = Date.now() - RETENTION_DAYS * 86400_000;

async function loadSources(): Promise<Source[]> {
  return (JSON.parse(await readFile("sources.json", "utf8")) as { sources: Source[] }).sources;
}

const hasKey = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

async function runNews(meta: Meta): Promise<NewsItem[]> {
  const sources = await loadSources();
  let existing = migrate(await readJson<LegacyNewsItem[]>(NEWS_PATH, []), sources);
  const saved = await readJson<Partial<State> & { notSecurity?: Record<string, string> }>(STATE_PATH, {});
  const state: State = {
    excluded: { ...saved.notSecurity, ...saved.excluded },
    failures: saved.failures ?? {},
    rejudged: saved.rejudged ?? {},
    bodyRetries: saved.bodyRetries ?? {},
  };

  const { items, statuses } = await fetchFeeds(sources);
  meta.sources = statuses;
  for (const s of statuses) console.log(`${s.ok ? "OK  " : "FAIL"} ${s.name.padEnd(22)} ${s.ok ? s.items : s.error}`);

  const known = new Set([
    ...existing.map((n) => n.id),
    ...Object.keys(state.excluded),
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
  // 제목만 봐도 행사·홍보·인사 기사인 건 LLM을 부르기 전에 뺀다
  let keywordExcluded = 0;
  for (const [id, raw] of candidates) {
    const hit = keywordExclusion(raw.title);
    if (!hit) continue;
    state.excluded[id] = new Date().toISOString();
    candidates.delete(id);
    keywordExcluded++;
    console.log(`  ~  [키워드 "${hit}"] ${raw.title.slice(0, 60)}`);
  }

  // 최신 기사부터 처리하고, 한도를 넘는 건 다음 실행으로 미룬다
  const queue = [...candidates.entries()].sort((a, b) => b[1].publishedAt.localeCompare(a[1].publishedAt));
  // 키가 없으면 요약을 건너뛰고 다음 실행으로 미룬다 (취약점 수집은 계속)
  if (!hasKey()) console.warn("\nANTHROPIC_API_KEY가 없어 기사 요약을 건너뜁니다.");
  const batch = hasKey() ? queue.slice(0, limit) : [];
  console.log(
    `\n새 기사 ${queue.length}건 중 ${batch.length}건 요약 시작 (모델 ${process.env.SUMMARY_MODEL ?? "claude-haiku-5-5"})`,
  );

  const stats: RunStats = {
    candidates: queue.length + keywordExcluded,
    added: 0,
    keywordExcluded,
    notSecurity: 0,
    failed: 0,
    deferred: queue.length - batch.length,
  };
  const added: NewsItem[] = [];
  let configFailed = false;

  await mapLimit(batch, CONCURRENCY, async ([id, raw]) => {
    if (configFailed) return;
    try {
      // 벤더 분석 글은 기법·IoC가 뒤쪽에 있어 본문을 더 길게 읽는다
      const body = await extractArticle(raw.url, raw.source.kind === "vendor" ? BODY_CHARS.long : BODY_CHARS.news);
      const result = await summarize(raw, body);
      if (result.kind === "excluded") {
        state.excluded[id] = new Date().toISOString();
        stats.notSecurity++;
        console.log(`  -  [${result.reason}] ${raw.title.slice(0, 60)}`);
        return;
      }
      const item = result.item;
      item.id = id;
      state.rejudged[id] = RULES_VERSION; // 새 기준으로 요약했으니 다시 판정할 필요 없음
      added.push(item);
      delete state.failures[id];
      stats.added++;
      console.log(`  +  [${item.basis}] ${item.titleKo.slice(0, 60)}`);
      if (dry) console.log(JSON.stringify(item, null, 2));
    } catch (e) {
      if (isConfigError(e)) {
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
  console.log(
    `\n추가 ${stats.added} · 키워드 제외 ${stats.keywordExcluded} · LLM 제외 ${stats.notSecurity} · 실패 ${stats.failed} · 다음으로 미룸 ${stats.deferred}`,
  );

  // 일본어가 비어 있는 기존 기사 채우기 (이전 형식에서 넘어온 기사)
  const missingJa = existing.filter((n) => n.summaryJa.length === 0);
  if (missingJa.length && hasKey() && !configFailed) {
    const chunks: NewsItem[][] = [];
    for (let i = 0; i < missingJa.length; i += TRANSLATE_BATCH) chunks.push(missingJa.slice(i, i + TRANSLATE_BATCH));
    let filled = 0;
    await mapLimit(chunks, 3, async (chunk) => {
      if (configFailed) return;
      try {
        const ja = await translateToJa(chunk);
        for (const n of chunk) {
          const t = ja.get(n.id);
          if (!t) continue;
          // 일본 매체 기사는 원제목이 이미 일본어다
          n.titleJa = sources.find((src) => src.id === n.sourceId)?.lang === "ja" ? n.title : t.titleJa;
          n.summaryJa = t.summaryJa;
          filled++;
        }
      } catch (e) {
        if (isConfigError(e)) configFailed = true;
        console.warn(`  !  일본어 채우기 실패 (${chunk.length}건): ${(e as Error).message.slice(0, 120)}`);
      }
    });
    console.log(`기존 기사 일본어 채움 ${filled}/${missingJa.length}`);
  }

  // 품질 점검: 본문 다시 읽기, 새 기준으로 '연구·리포트' 다시 판정 (일반 해설·홍보 제외)
  if (hasKey() && !configFailed) {
    const retry = await retryWeakBodies(existing, sources, state);
    const drop = await rejudgeResearch(existing, state);
    for (const id of retry.dropped) drop.add(id);
    const now = new Date().toISOString();
    for (const id of drop) state.excluded[id] = now;
    existing = existing.filter((n) => !drop.has(n.id));
    console.log(`품질 점검: 본문 다시 읽기 성공 ${retry.improved} · 제외 ${drop.size}`);
  }

  const merged = [...added, ...existing]
    .filter((n) => Date.parse(n.publishedAt) >= cutoff)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  // 더 이상 없는 기사의 품질 점검 기록은 지운다
  const alive = new Set(merged.map((n) => n.id));
  for (const id of Object.keys(state.rejudged)) if (!alive.has(id)) delete state.rejudged[id];
  for (const id of Object.keys(state.bodyRetries)) if (!alive.has(id)) delete state.bodyRetries[id];

  // 오래된 내부 상태 정리 (피드에서 이미 사라졌을 기사)
  for (const [id, at] of Object.entries(state.excluded)) if (Date.parse(at) < cutoff) delete state.excluded[id];

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
    topicCount: 0,
    kevCount: 0,
    cveCount: 0,
    sources: [],
  });

  let news = migrate(await readJson<LegacyNewsItem[]>(NEWS_PATH, []), await loadSources());
  if (mode !== "vulns") news = await runNews(meta);

  // 언어 점검 1: 기사의 일본어 필드·엔티티 이름 (토픽 엔티티는 기사에서 다시 계산된다)
  if (hasKey()) {
    const a = await auditArticles(news);
    console.log(`언어 점검(기사): 일본어 다시 번역 ${a.ja} · 이름 바로잡기 ${a.names} · 남은 문제 ${a.remaining}`);
    if (!dry && (a.ja || a.names)) await writeJson(NEWS_PATH, news);
  }

  let vulns = await readJson<VulnData | null>(VULNS_PATH, null);
  if (mode !== "news") {
    const mentionedCves = [...new Set(news.flatMap((n) => n.entities.cves))];
    vulns = await collectVulns(mentionedCves);
    console.log(
      `KEV ${vulns.kev.length}건 · 고위험 CVE ${vulns.cves.length}건 · 기사 속 CVE EPSS ${Object.keys(vulns.mentioned).length}건`,
    );
    meta.kevCount = vulns.kev.length;
    meta.cveCount = vulns.cves.length;
    if (!dry) await writeJson(VULNS_PATH, vulns);
  }

  // 토픽(まとめ): 기사 묶기, 통합 요약, 중요도
  const prevTopics = await readJson<Topic[]>(TOPICS_PATH, []);
  const checkedPairs = new Set(await readJson<string[]>(MERGE_CHECKED_PATH, []));
  const { topics, stats } = await updateTopics(news, prevTopics, vulns, {
    useLlm: hasKey(),
    isConfigError,
    checkedPairs,
  });
  console.log(
    `토픽 ${topics.length}개 · 기존 토픽에 배정 ${stats.assigned} · 새 토픽 ${stats.created} · 다시 합침 ${stats.merged} · 통합 요약 ${stats.synthesized} · 실패 ${stats.failed}`,
  );
  // 지금 있는 토픽의 쌍만 기억한다 (파일이 끝없이 커지지 않게)
  const liveTopics = new Set(topics.map((t) => t.id));
  const keepPairs = [...checkedPairs].filter((k) => k.split("|").every((id) => liveTopics.has(id)));
  if (!dry) await writeJson(MERGE_CHECKED_PATH, keepPairs);
  // 언어 점검 2: 토픽 통합 요약의 일본어 필드
  if (hasKey()) {
    const fixed = await auditTopics(topics);
    if (fixed) console.log(`언어 점검(토픽): 일본어 다시 번역 ${fixed}`);
  }
  meta.topicCount = topics.length;
  if (!dry) await writeJson(TOPICS_PATH, topics);

  // 오늘의 브리핑 (일본 시간 아침, 하루 한 번)
  if (hasKey()) {
    try {
      const prev = await readJson<Briefing[]>(BRIEFINGS_PATH, []);
      const { briefings, made } = await maybeBriefing(topics, prev, forceBriefing);
      if (made) console.log(`브리핑 생성: ${briefings[0].date} · ${briefings[0].items.length}건`);
      // 언어 점검 3: 브리핑의 일본어 문장
      const fixed = await auditBriefings(briefings);
      if (fixed) console.log(`언어 점검(브리핑): 일본어 다시 번역 ${fixed}`);
      if (!dry && (made || fixed)) await writeJson(BRIEFINGS_PATH, briefings);
    } catch (e) {
      console.warn(`  !  브리핑 실패: ${(e as Error).message.slice(0, 160)}`);
    }
  }

  const refs: ArticleRef[] = news.map((n) => ({
    id: n.id,
    url: n.url,
    title: n.title,
    titleKo: n.titleKo,
    titleJa: n.titleJa,
    sourceName: n.sourceName,
    sourceKind: n.sourceKind,
    publishedAt: n.publishedAt,
    basis: n.basis,
  }));
  if (!dry) await writeJson(ARTICLES_PATH, refs);

  meta.newsCount = news.length;
  meta.updatedAt = new Date().toISOString();
  if (!dry) await writeJson(META_PATH, meta);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
