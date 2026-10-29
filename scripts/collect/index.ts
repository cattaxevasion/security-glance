// 수집 진입점.
//   npm run collect              뉴스 + 취약점 전부
//   npm run collect -- news      뉴스만
//   npm run collect -- vulns     취약점만
//   --limit N                    이번 실행에서 요약할 새 기사 최대 개수 (기본 80)
//   --dry                        요약 결과를 출력만 하고 저장하지 않음
//   --briefing                   오늘의 브리핑을 시각과 상관없이 다시 만든다
//   --full                       전체 실행 (평소에는 지난 전체 실행에서 6시간이 지났을 때만)
//
// 30분마다 돈다. 평소에는 가벼운 실행: 매체 피드만 보고, 새 기사가 없으면 저장·배포 없이 바로 끝낸다.
// 6시간마다 전체 실행: 벤더 리서치 피드, 취약점(KEV·NVD·EPSS), 랜섬웨어 유출 게시, 기사 품질 점검까지.
import Anthropic from "@anthropic-ai/sdk";
import { existsSync } from "node:fs";
import { appendFile, readFile, rm } from "node:fs/promises";
import { splitTopics, TEXT_LANGS, topicFile } from "../../shared/topic-files";
import type { ArticleRef, Briefing, LeakPost, Meta, NewsItem, RunStats, Topic, VulnData } from "../../shared/types";
import { collectLeaks, matchLeaks, pruneLeakTopics } from "./leaks";
import { BODY_CHARS, extractArticle } from "./article";
import { briefingDue, maybeBriefing, migrateBriefings } from "./briefing";
import {
  auditArticles,
  auditBriefings,
  auditTopics,
  enforceBriefings,
  enforceLanguage,
  fillEnglish,
  forcedStore,
  loadForced,
  sumCount,
  updateNameEnglish,
  updateNameReadings,
  type FixCount,
} from "./lang-audit";
import { RULES_VERSION, rejudgeResearch, retryWeakBodies } from "./quality";
import { keywordExclusion } from "./filter";
import { fetchFeeds, type RawItem, type Source } from "./rss";
import { EXCLUDED_NATURE, SummaryRefused, summarize, translateToJa } from "./summarize";
import { idFor, mapLimit, readJson, writeJson } from "./util";
import { updateTopics } from "./topics";
import { collectVulns } from "./vulns";

const NEWS_PATH = "public/data/news.json";
/** 취약점 전체 (수집기 내부용). 화면은 아래 둘로 나눠 받는다. */
const VULNS_PATH = "public/data/vulns.json";
/** 첫 화면용: KEV와 기사 속 CVE의 EPSS (고위험 CVE 목록은 빈 배열) */
const VULNS_CORE_PATH = "public/data/vulns-core.json";
/** 고위험 CVE 목록. CVE 화면을 열 때(또는 첫 화면이 뜬 뒤) 받는다. */
const CVES_PATH = "public/data/cves.json";
/** 랜섬웨어 유출 사이트 게시 (일본) */
const LEAKS_PATH = "public/data/leaks.json";
const META_PATH = "public/data/meta.json";
/** 지난 전체 실행 시각 (수집기 내부용) */
const RUN_PATH = "data/run.json";
/** 전체 실행 간격. 30분 주기 실행이 조금 일찍 와도 놓치지 않게 15분 여유 */
const FULL_EVERY_MS = 6 * 3600_000 - 15 * 60_000;
/** 브리핑이 실패하면 이만큼 지난 뒤에 다시 (실패할 때마다 모든 실행이 저장·배포까지 가지 않게) */
const BRIEFING_RETRY_MS = 25 * 60_000;

interface RunState {
  fullAt?: string;
  /** 브리핑을 마지막으로 시도한 시각과 실패 이유 (성공하면 지움). GitHub 로그 없이도 data 브랜치에서 보인다 */
  briefingTriedAt?: string;
  briefingError?: string;
  /** 마지막 브리핑을 첫 단계가 아닌 단계로 만들었을 때 그 내용 */
  briefingNote?: string;
}
/** 화면용 가벼운 기사 목록 (news.json은 수집기 내부용) */
const ARTICLES_PATH = "public/data/articles.json";
/** 토픽 전체 (수집기 내부용). 화면은 아래 두 파일로 나눠 받는다. */
const TOPICS_PATH = "public/data/topics.json";
/** 일본어로 적힌 조직·위협 그룹 이름의 한국어 화면용 읽기 */
const NAMES_KO_PATH = "public/data/names-ko.json";
/** 같은 이름의 영어 화면용 표기 */
const NAMES_EN_PATH = "public/data/names-en.json";
/** 기계 변환한 필드의 원래 글 (다음 실행에서 모델로 다시 고친다) */
const LANG_FORCED_PATH = "data/lang-forced.json";
/**
 * 화면용 토픽은 최근(첫 화면, 인시던트 기본 기간 30일 + 여유 하루)과 그 이전(화면이 뜬 뒤에 불러옴)으로 나누고,
 * 각각 언어와 무관한 부분과 언어별 제목·요약으로 다시 나눈다 (shared/topic-files.ts: topics-recent-core.json + topics-recent-{ko,ja,en}.json).
 * 나누기 전의 파일이 남아 있으면 지운다 (data 브랜치에서 실행마다 되살아나지 않게)
 */
const LEGACY_TOPIC_PATHS = ["public/data/topics-recent.json", "public/data/topics-archive.json"];
const RECENT_DAYS = 31;
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
/**
 * 영어가 비어 있는 이전 기사·토픽을 한 실행에 몇 건까지 채울지 (최신 먼저). 저장·배포까지 가는 실행에서만 돈다.
 * 기사 약 1,300건 · 토픽 약 160개(기사 2건 이상)가 8~10번 실행에 나눠 채워진다
 */
const EN_FILL_ARTICLES = 150;
const EN_FILL_TOPICS = 100;

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

type LegacyNewsItem = Omit<NewsItem, "sourceRegion" | "regions" | "titleEn" | "summaryEn"> & {
  titleEn?: string;
  summaryEn?: string[];
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
 * - 영어 필드(2026-10): 영어 매체 기사는 원제목이 곧 영어 제목, 나머지는 빈 값 (채우기 단계가 채운다)
 * - 한국어 요약이 빈 기사 삭제 (모델이 빈 요약을 돌려준 것. 피드에 아직 있으면 새 기사로 다시 요약된다)
 */
function migrate(items: LegacyNewsItem[], sources: Source[]): NewsItem[] {
  const dropped = { nature: 0, korea: 0, url: 0, empty: 0 };
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
    // http·https가 아닌 주소는 화면 링크로 쓰지 않는다
    if (!/^https?:\/\//i.test(n.url)) {
      dropped.url++;
      continue;
    }
    const summaryKo = n.summaryKo ?? summary ?? [];
    if (!summaryKo.length) {
      dropped.empty++;
      continue;
    }
    const regions = n.regions.filter((r): r is NewsItem["regions"][number] => r === "INTL" || r === "JP");
    const src = sources.find((s) => s.id === n.sourceId);
    out.push({
      ...n,
      sourceRegion: n.sourceRegion as NewsItem["sourceRegion"],
      sourceKind: n.sourceKind ?? src?.kind ?? "news",
      regions: regions.length ? regions : ["INTL"],
      summaryKo,
      summaryJa: n.summaryJa ?? [],
      titleJa: n.titleJa ?? "",
      titleEn: n.titleEn || (src?.lang === "en" ? n.title : ""),
      summaryEn: n.summaryEn ?? [],
      techniques: n.techniques ?? [],
      iocTypes: n.iocTypes ?? [],
    });
  }
  if (dropped.nature) console.log(`기존 업계 동향 기사 ${dropped.nature}건 삭제`);
  if (dropped.korea) console.log(`한국 매체 기사 ${dropped.korea}건 삭제`);
  if (dropped.url) console.log(`http·https가 아닌 주소의 기사 ${dropped.url}건 삭제`);
  if (dropped.empty) console.log(`한국어 요약이 빈 기사 ${dropped.empty}건 삭제 (피드에 있으면 다시 요약)`);
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
const forceFull = args.includes("--full");
const limitArg = args.indexOf("--limit");
const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : Number(process.env.MAX_NEW_PER_RUN ?? 80);

const cutoff = Date.now() - RETENTION_DAYS * 86400_000;

async function loadSources(): Promise<Source[]> {
  return (JSON.parse(await readFile("sources.json", "utf8")) as { sources: Source[] }).sources;
}

const hasKey = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

/** GitHub Actions의 다음 단계에 결과를 넘긴다 (로컬 실행에서는 아무것도 안 함) */
async function setOutput(key: string, value: string) {
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}

/** full=false(가벼운 실행)면 벤더 리서치 피드와 품질 점검을 건너뛴다. processed: 이번에 처리한 새 기사 수 */
async function runNews(meta: Meta, full: boolean): Promise<{ news: NewsItem[]; processed: number }> {
  const sources = await loadSources();
  let existing = migrate(await readJson<LegacyNewsItem[]>(NEWS_PATH, []), sources);
  const saved = await readJson<Partial<State> & { notSecurity?: Record<string, string> }>(STATE_PATH, {});
  const state: State = {
    excluded: { ...saved.notSecurity, ...saved.excluded },
    failures: saved.failures ?? {},
    rejudged: saved.rejudged ?? {},
    bodyRetries: saved.bodyRetries ?? {},
  };

  // 벤더 리서치는 급하지 않고 피드가 커서(수백 건) 전체 실행 때만 읽는다
  const { items, statuses } = await fetchFeeds(full ? sources : sources.filter((s) => s.kind !== "vendor"));
  // 이번에 건너뛴 출처는 지난 상태를 그대로 둔다
  meta.sources = sources.flatMap((src) => {
    const st = statuses.find((x) => x.id === src.id) ?? meta.sources.find((x) => x.id === src.id);
    return st ? [st] : [];
  });
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
  if (full && hasKey() && !configFailed) {
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
  return { news: merged, processed: queue.length };
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

  const run = await readJson<RunState>(RUN_PATH, {});
  const prevBriefings = migrateBriefings(await readJson<Briefing[]>(BRIEFINGS_PATH, []));
  const briefingWanted =
    forceBriefing ||
    (briefingDue(prevBriefings) &&
      (!run.briefingTriedAt || Date.now() - Date.parse(run.briefingTriedAt) >= BRIEFING_RETRY_MS));
  const full =
    forceFull || mode !== "all" || !run.fullAt || Date.now() - Date.parse(run.fullAt) >= FULL_EVERY_MS;
  console.log(full ? "전체 실행" : `가벼운 실행 (지난 전체 실행 ${run.fullAt})`);

  let news = migrate(await readJson<LegacyNewsItem[]>(NEWS_PATH, []), await loadSources());
  let processed = 0;
  if (mode !== "vulns") ({ news, processed } = await runNews(meta, full));

  // 새 기사도, 전체 점검도, 브리핑도 없으면 여기서 끝낸다 (AI 호출·저장·배포 없음)
  if (!full && !processed && !briefingWanted) {
    // 코드를 push한 실행은 이렇게 끝나도 배포한다: 화면용 토픽 파일이 예전 형식뿐이면 지금 형식으로 나눠 둔다 (AI 호출 없음)
    if (!dry) await writeTopicFiles(await readJson<Topic[]>(TOPICS_PATH, []), true);
    console.log("\n새 기사 없음: 저장·배포 없이 끝냅니다");
    await setOutput("changed", "false");
    return;
  }

  loadForced(await readJson(LANG_FORCED_PATH, {}));
  // 언어 점검 1: 기사의 일본어·한국어 필드·엔티티 이름 (토픽 엔티티는 기사에서 다시 계산된다)
  if (hasKey()) {
    const a = await auditArticles(news);
    console.log(
      `언어 점검(기사): 일본어 ${fmt(a.ja)} · 한국어 ${fmt(a.ko)} · 영어 ${fmt(a.en)} · 이름 원래 표기 ${a.names}`,
    );
    // 영어가 비어 있는 이전 기사 채우기 (토픽을 만들기 전에: 기사 1건짜리 토픽은 기사의 영어를 그대로 쓴다)
    const fill = await fillEnglish(news, (n) => n.title, EN_FILL_ARTICLES);
    if (fill.missing) console.log(`영어 채우기(기사): ${fill.filled}/${fill.missing}`);
    const changed = sumCount(a.ja, a.ko, a.en);
    if (!dry && (changed.fixed || changed.forced || a.names || fill.filled)) await writeJson(NEWS_PATH, news);
    const { readings, count } = await updateNameReadings(
      news.flatMap((n) => [...n.entities.orgs, ...n.entities.actors]),
      await readJson<Record<string, string>>(NAMES_KO_PATH, {}),
    );
    console.log(`언어 점검(이름 한국어 읽기): ${Object.keys(readings).length}개 · 새로 ${fmt(count)}`);
    if (!dry) await writeJson(NAMES_KO_PATH, readings);
    const en = await updateNameEnglish(
      news.flatMap((n) => [...n.entities.orgs, ...n.entities.actors]),
      await readJson<Record<string, string>>(NAMES_EN_PATH, {}),
    );
    console.log(`언어 점검(이름 영어 표기): ${Object.keys(en.english).length}개 · 새로 ${fmt(en.count)}`);
    if (!dry) await writeJson(NAMES_EN_PATH, en.english);
  }

  let vulns = await readJson<VulnData | null>(VULNS_PATH, null);
  if (mode !== "news" && full) {
    const mentionedCves = [...new Set(news.flatMap((n) => n.entities.cves))];
    vulns = await collectVulns(mentionedCves, vulns);
    console.log(
      `KEV ${vulns.kev.length}건 · 고위험 CVE ${vulns.cves.length}건 · 기사 속 CVE EPSS ${Object.keys(vulns.mentioned).length}건`,
    );
    meta.kevCount = vulns.kev.length;
    meta.cveCount = vulns.cves.length;
    if (!dry) await writeJson(VULNS_PATH, vulns);
  }
  if (vulns && !dry) {
    await writeJson(VULNS_CORE_PATH, {
      ...vulns,
      cves: [],
      criticalCount: vulns.cves.filter((c) => (c.cvss ?? 0) >= 9).length,
    });
    await writeJson(CVES_PATH, vulns.cves);
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
  // 언어 점검 2: 토픽 통합 요약의 일본어·한국어·영어 필드 (영어가 비어 있는 이전 토픽은 먼저 채운다)
  if (hasKey()) {
    // 기사 1건짜리 토픽은 기사의 영어를 그대로 쓰므로 (기사를 채우면 같이 채워진다) 2건 이상인 토픽만
    const order = topics
      .filter((t) => t.articleIds.length > 1)
      .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));
    const fill = await fillEnglish(order, () => "", EN_FILL_TOPICS);
    if (fill.missing) console.log(`영어 채우기(토픽): ${fill.filled}/${fill.missing}`);
    const f = await auditTopics(topics);
    console.log(`언어 점검(토픽): 일본어 ${fmt(f.ja)} · 한국어 ${fmt(f.ko)} · 영어 ${fmt(f.en)}`);
  }
  // 배포 전 마지막 확인: 위 단계가 다 고쳤다면 0
  const gateTopics = enforceLanguage("topic", topics);
  if (gateTopics) console.warn(`  !  마지막 확인(토픽)에서 기계 변환 ${gateTopics}건`);
  meta.topicCount = topics.length;
  if (!dry) {
    await writeJson(TOPICS_PATH, topics);
    await writeTopicFiles(topics);
  }

  // 랜섬웨어 유출 사이트 게시 (일본): 보도 토픽과 연결
  try {
    const prevLeaks = await readJson<LeakPost[]>(LEAKS_PATH, []);
    const leaks = full ? await collectLeaks(prevLeaks) : prevLeaks;
    pruneLeakTopics(leaks, topics);
    let matched = 0;
    if (hasKey()) {
      try {
        matched = await matchLeaks(leaks, topics);
      } catch (e) {
        console.warn(`  !  유출 게시와 보도 연결 실패: ${(e as Error).message.slice(0, 120)}`);
      }
    }
    console.log(
      `랜섬웨어 유출 게시(일본, 30일) ${leaks.length}건 · 보도와 연결 ${leaks.filter((x) => x.topicIds.length).length}건 (이번에 ${matched})`,
    );
    if (!dry) await writeJson(LEAKS_PATH, leaks);
  } catch (e) {
    console.warn(`  !  랜섬웨어 유출 게시 수집 실패 (이전 데이터 유지): ${(e as Error).message.slice(0, 120)}`);
  }

  // 오늘의 브리핑 (일본 시간 아침, 하루 한 번)
  if (hasKey()) {
    try {
      const prev = prevBriefings;
      if (briefingWanted) run.briefingTriedAt = new Date().toISOString();
      const { briefings, made, note } = briefingWanted
        ? await maybeBriefing(topics, prev, forceBriefing)
        : { briefings: prev, made: false, note: undefined };
      if (made) {
        console.log(`브리핑 생성: ${briefings[0].date} · ${briefings[0].items.length}건`);
        delete run.briefingError;
        if (note) run.briefingNote = `${new Date().toISOString()} ${note.slice(0, 600)}`;
        else delete run.briefingNote;
      }
      // 언어 점검 3: 브리핑의 일본어·한국어 문장
      const f = await auditBriefings(briefings);
      const total = sumCount(f.ja, f.ko, f.en);
      console.log(`언어 점검(브리핑): 일본어 ${fmt(f.ja)} · 한국어 ${fmt(f.ko)} · 영어 ${fmt(f.en)}`);
      const gate = enforceBriefings(briefings);
      if (gate) console.warn(`  !  마지막 확인(브리핑)에서 기계 변환 ${gate}건`);
      if (!dry && (made || total.fixed || total.forced || gate)) await writeJson(BRIEFINGS_PATH, briefings);
    } catch (e) {
      run.briefingError = `${new Date().toISOString()} ${(e as Error).message.slice(0, 600)}`;
      console.warn(`  !  브리핑 실패: ${(e as Error).message.slice(0, 600)}`);
    }
  }

  const gateNews = enforceLanguage("article", news);
  if (gateNews) {
    console.warn(`  !  마지막 확인(기사)에서 기계 변환 ${gateNews}건`);
    if (!dry) await writeJson(NEWS_PATH, news);
  }
  const refs: ArticleRef[] = news.map((n) => ({
    id: n.id,
    url: n.url,
    title: n.title,
    titleKo: n.titleKo,
    titleJa: n.titleJa,
    titleEn: n.titleEn,
    sourceName: n.sourceName,
    sourceKind: n.sourceKind,
    publishedAt: n.publishedAt,
    basis: n.basis,
  }));
  if (!dry) await writeJson(ARTICLES_PATH, refs);

  const forced = forcedStore();
  if (Object.keys(forced).length) console.log(`기계 변환으로 마무리한 필드 ${Object.keys(forced).length}개 (다음 실행에서 모델로 다시 고침)`);
  if (!dry) await writeJson(LANG_FORCED_PATH, forced);

  meta.newsCount = news.length;
  meta.updatedAt = new Date().toISOString();
  if (!dry) {
    await writeJson(META_PATH, meta);
    await writeJson(RUN_PATH, full ? { ...run, fullAt: meta.updatedAt } : run);
  }
  await setOutput("changed", "true");
}

/** 화면용 토픽 파일 쓰기 (최근·지난 × 언어와 무관한 부분·언어별 글). onlyIfMissing이면 이미 지금 형식일 때 아무것도 안 함 */
async function writeTopicFiles(topics: Topic[], onlyIfMissing = false) {
  if (onlyIfMissing && (existsSync(`public/data/${topicFile("recent", "core")}`) || !topics.length)) return;
  const recentCut = Date.now() - RECENT_DAYS * 86400_000;
  const isRecent = (t: Topic) => Date.parse(t.lastUpdated) >= recentCut;
  for (const [part, list] of [
    ["recent", topics.filter(isRecent)],
    ["archive", topics.filter((t) => !isRecent(t))],
  ] as const) {
    const { core, texts } = splitTopics(list);
    await writeJson(`public/data/${topicFile(part, "core")}`, core);
    for (const l of TEXT_LANGS) await writeJson(`public/data/${topicFile(part, l)}`, texts[l]);
  }
  for (const p of LEGACY_TOPIC_PATHS) await rm(p, { force: true });
}

/** 고친 수 표시: "고침 3" 또는 "고침 3 · 기계 변환 1" */
function fmt(c: FixCount): string {
  return c.forced ? `고침 ${c.fixed} · 기계 변환 ${c.forced}` : `고침 ${c.fixed}`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
