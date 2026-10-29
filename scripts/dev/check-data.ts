// 데이터 무결성 점검 (개발용). 수집 데이터 안의 연결이 서로 맞는지 본다.
//   npm run data:pull && npx tsx scripts/dev/check-data.ts
import { existsSync, readFileSync, statSync } from "node:fs";
import type { Briefing, LeakPost, NewsItem, Topic, VulnData } from "../../shared/types";
import { ATTACK_TYPES, NATURES, REGIONS, SECTORS } from "../../shared/taxonomy";

const read = <T>(p: string, d: T): T => (existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : d);
const news = read<NewsItem[]>("public/data/news.json", []);
const topics = read<Topic[]>("public/data/topics.json", []);
const recent = read<Topic[]>("public/data/topics-recent.json", []);
const archive = read<Topic[]>("public/data/topics-archive.json", []);
const briefings = read<Briefing[]>("public/data/briefings.json", []);
const leaks = read<LeakPost[]>("public/data/leaks.json", []);
const vulns = read<VulnData | null>("public/data/vulns.json", null);
const articles = read<{ id: string }[]>("public/data/articles.json", []);
const merge = read<string[]>("data/merge-checked.json", []);
const names = read<Record<string, string>>("public/data/names-ko.json", {});
const forced = read<Record<string, unknown>>("data/lang-forced.json", {});

const issues: string[] = [];
const bad = (cond: boolean, msg: string) => cond && issues.push(msg);
const now = Date.now();

// 기사
const newsById = new Map(news.map((n) => [n.id, n]));
bad(newsById.size !== news.length, `기사 id 중복 ${news.length - newsById.size}건`);
const urls = new Set(news.map((n) => n.url));
bad(urls.size !== news.length, `기사 주소 중복 ${news.length - urls.size}건`);
for (const n of news) {
  bad(!/^https?:\/\//.test(n.url), `기사 ${n.id}: http 아닌 주소`);
  bad(Date.parse(n.publishedAt) > now + 3600_000, `기사 ${n.id}: 미래 날짜 ${n.publishedAt}`);
  bad(Number.isNaN(Date.parse(n.publishedAt)), `기사 ${n.id}: 날짜 이상 ${n.publishedAt}`);
  bad(!n.summaryKo.length, `기사 ${n.id}: 한국어 요약 없음`);
  bad(!NATURES.includes(n.nature), `기사 ${n.id}: 성격 값 이상 ${n.nature}`);
  bad(!n.regions.length || n.regions.some((r) => !REGIONS.includes(r)), `기사 ${n.id}: 지역 이상 ${n.regions}`);
  bad(n.attackTypes.some((a) => !ATTACK_TYPES.includes(a)), `기사 ${n.id}: 공격 유형 이상`);
  bad(n.sectors.some((s) => !SECTORS.includes(s)), `기사 ${n.id}: 산업 이상`);
}
const oldest = news.map((n) => n.publishedAt).sort()[0];
bad(!!oldest && now - Date.parse(oldest) > 92 * 86400_000, `보관 기간(90일)보다 오래된 기사 있음: ${oldest}`);

// 토픽
const topicIds = new Map<string, number>();
for (const t of topics) topicIds.set(t.id, (topicIds.get(t.id) ?? 0) + 1);
for (const [id, c] of topicIds) bad(c > 1, `토픽 id 중복 ${id} × ${c}`);
const owner = new Map<string, string>();
for (const t of topics) {
  bad(!t.articleIds.length, `토픽 ${t.id}: 기사 없음`);
  for (const a of t.articleIds) {
    bad(!newsById.has(a), `토픽 ${t.id}: 없는 기사 ${a}`);
    bad(owner.has(a) && owner.get(a) !== t.id, `기사 ${a}가 토픽 두 개에 (${owner.get(a)}, ${t.id})`);
    owner.set(a, t.id);
  }
  bad(!t.titleKo || !t.titleJa, `토픽 ${t.id}: 제목 비어 있음`);
  bad(!t.summaryKo.length, `토픽 ${t.id}: 한국어 요약 없음`);
  bad(Date.parse(t.firstSeen) > Date.parse(t.lastUpdated), `토픽 ${t.id}: firstSeen > lastUpdated`);
  bad(!t.collectedAt, `토픽 ${t.id}: collectedAt 없음`);
  bad(Number.isNaN(t.importance), `토픽 ${t.id}: 중요도 NaN`);
}
const orphan = news.filter((n) => !owner.has(n.id));
bad(orphan.length > 0, `토픽에 안 들어간 기사 ${orphan.length}건`);

// 화면용 나눈 파일
if (recent.length || archive.length) {
  const split = new Set([...recent, ...archive].map((t) => t.id));
  bad(split.size !== topics.length, `나눈 토픽 파일(${split.size})과 전체본(${topics.length}) 수가 다름`);
  bad(
    recent.some((t) => archive.some((a) => a.id === t.id)),
    "최근·지난 토픽 파일에 같은 토픽이 겹침",
  );
}
bad(articles.length !== news.length, `articles.json(${articles.length})과 news.json(${news.length}) 수가 다름`);

// 브리핑·유출 게시·토픽 합치기 기록
const alive = new Set(topics.map((t) => t.id));
for (const b of briefings) {
  const missing = b.items.filter((i) => !alive.has(i.topicId)).length;
  // 지난 브리핑은 토픽이 합쳐지거나 보관 기간이 지나 사라질 수 있다 → 최신 브리핑만 엄격하게
  if (b === briefings[0]) bad(missing > 0, `최신 브리핑(${b.date})의 항목 ${missing}개가 없는 토픽을 가리킴`);
}
bad(briefings.length > 30, `브리핑 ${briefings.length}개 (30개 유지 규칙)`);
for (const l of leaks) for (const id of l.topicIds) bad(!alive.has(id), `유출 게시 ${l.victim}: 없는 토픽 ${id}`);
bad(
  merge.some((k) => k.split("|").some((id) => !alive.has(id))),
  "토픽 합치기 기록에 없는 토픽",
);
const nameSet = new Set(news.flatMap((n) => [...n.entities.orgs, ...n.entities.actors]));
bad(
  Object.keys(names).some((k) => !nameSet.has(k)),
  `이름 읽기 사전에 지금 없는 이름 ${Object.keys(names).filter((k) => !nameSet.has(k)).length}개`,
);

// 취약점
if (vulns) {
  bad(vulns.kev.length === 0, "KEV 0건");
  bad(vulns.cves.length === 0, "고위험 CVE 0건");
}

// 영어 채우기 진행 (채우는 동안은 비어 있어도 문제로 세지 않는다. 화면은 안내 문구로 대신 보여준다)
const filled = <T>(xs: T[], ok: (x: T) => boolean) => `${xs.filter(ok).length}/${xs.length}`;
console.log(
  `영어 채움: 기사 제목 ${filled(news, (n) => !!n.titleEn)} · 기사 요약 ${filled(news, (n) => !!n.summaryEn?.length)} · 토픽 ${filled(topics, (t) => !!t.titleEn && !!t.summaryEn?.length)} · 브리핑 ${filled(briefings, (b) => !!b.headlineEn && b.items.every((i) => i.titleEn && i.bodyEn && i.whyEn))}`,
);

// 크기
const size = (p: string) => (existsSync(p) ? Math.round(statSync(p).size / 1024) : 0);
console.log(
  `기사 ${news.length} · 토픽 ${topics.length} (최근 ${recent.length} / 지난 ${archive.length}) · 브리핑 ${briefings.length} · 유출 게시 ${leaks.length} · 기계 변환 기록 ${Object.keys(forced).length}`,
);
console.log(
  "파일 크기(KB):",
  [
    "public/data/news.json",
    "public/data/topics.json",
    "public/data/topics-recent.json",
    "public/data/topics-archive.json",
    "public/data/articles.json",
    "public/data/vulns.json",
    "data/state.json",
  ]
    .map((p) => `${p.split("/").pop()} ${size(p)}`)
    .join(" · "),
);
console.log(issues.length ? `문제 ${issues.length}건:\n  - ${issues.slice(0, 40).join("\n  - ")}` : "문제 없음");
