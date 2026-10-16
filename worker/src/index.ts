// 속보 감시 (Cloudflare Worker, 1분마다).
// 매체 피드를 보고 처음 보는 보안 기사가 있으면 GitHub 수집기(update.yml)를 바로 실행시킨다.
// 요약·AI는 하지 않는다: 처리는 GitHub 수집기 한 곳에서만 해서 언어 검사·토픽 합치기가 한 벌로 유지된다.
// 확인한 기사는 KV에 짧은 해시로만 기억하고, 새 기사가 있을 때만 쓴다 (무료 플랜 쓰기 한도 하루 1,000번).
import sourcesFile from "../../sources.json";
import { SECURITY_KEYWORDS } from "../../shared/keywords";
import { keywordExclusion } from "../../scripts/collect/filter";

interface Env {
  SEEN: KVNamespace;
  /** 이 저장소의 Actions 실행 권한만 가진 fine-grained 토큰 (wrangler secret) */
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
  WORKFLOW: string;
}

interface Source {
  id: string;
  kind: string;
  url: string;
  keywordFilter?: boolean;
  /** 몇 분마다 볼지 (기본 1분). 본문 전체를 싣는 큰 블로그 피드는 10분: CPU 시간 대부분이 이런 피드 파싱이다 */
  watchEveryMin?: number;
}

// 벤더 리서치는 급하지 않고 피드가 커서(수백 건) 빼고, 매체·CERT만 본다
const WATCHED = (sourcesFile.sources as Source[]).filter((s) => s.kind !== "vendor");
const SLOW = WATCHED.filter((s) => (s.watchEveryMin ?? 1) > 1);
/** 기억할 기사 수. 감시하는 피드 전체 항목 수보다 넉넉히 커야 같은 기사로 다시 실행하지 않는다 */
const KEEP = 5000;
/** 이보다 오래된 기사는 무시 (피드가 옛 글을 다시 올려도 실행하지 않게). 수집기의 보관 기간보다 짧다 */
const MAX_AGE_MS = 3 * 86400_000;
const USER_AGENT = "SecurityGlanceWatch/1.0 (+https://cattaxevasion.github.io/security-glance/)";

interface Item {
  key: string;
  title: string;
  source: string;
}

export default {
  async scheduled(event: ScheduledController, env: Env): Promise<void> {
    const raw = await env.SEEN.get("seen");
    const seen: string[] = raw ? JSON.parse(raw) : [];
    const known = new Set(seen);

    const minute = Math.floor(event.scheduledTime / 60_000);
    // 큰 피드끼리 같은 분에 몰리지 않게 2분씩 어긋나게 본다
    const due = WATCHED.filter((s) => (minute + SLOW.indexOf(s) * 2) % (s.watchEveryMin ?? 1) === 0);
    const feeds = await Promise.allSettled(due.map((s) => readFeed(s, known)));
    const fresh = new Map<string, Item>();
    const failed: string[] = [];
    for (const [i, r] of feeds.entries()) {
      if (r.status === "rejected") {
        failed.push(due[i].id);
        continue;
      }
      for (const it of r.value) if (!fresh.has(it.key)) fresh.set(it.key, it);
    }
    if (failed.length) console.warn(`피드 실패: ${failed.join(", ")}`);
    if (!fresh.size) return;

    // 처음 켤 때는 지금 피드에 있는 기사를 기억만 한다 (전부 새 기사로 보고 실행하지 않게)
    if (seen.length) {
      const res = await dispatch(env);
      // 실패하면 기억하지 않는다: 다음 1분에 다시 시도
      if (!res.ok) {
        console.error(`수집기 실행 요청 실패 HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
        return;
      }
      for (const it of fresh.values()) console.log(`새 기사 [${it.source}] ${it.title}`);
      console.log(`새 기사 ${fresh.size}건 → 수집기 실행 요청`);
    } else {
      console.log(`처음 실행: 기사 ${fresh.size}건을 기억만 함`);
    }
    await env.SEEN.put("seen", JSON.stringify([...fresh.keys(), ...seen].slice(0, KEEP)));
  },
};

function dispatch(env: Env): Promise<Response> {
  return fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${env.WORKFLOW}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({ ref: "main" }),
  });
}

/** RSS·RDF·Atom 공통으로 항목만 정규식으로 뽑는다 (무료 플랜 CPU 10ms 안에 들도록 XML 파서를 쓰지 않음) */
async function readFeed(source: Source, known: Set<string>): Promise<Item[]> {
  const res = await fetch(source.url, {
    headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`${source.id} HTTP ${res.status}`);
  const xml = await res.text();
  const now = Date.now();
  const items: Item[] = [];
  for (const m of xml.matchAll(/<(item|entry)[\s>][\s\S]*?<\/\1>/g)) {
    const block = m[0];
    const link = tag(block, "link") || block.match(/<link[^>]*href="([^"]+)"/)?.[1] || "";
    if (!link.startsWith("http")) continue;
    const key = hash(link.trim());
    // 이미 아는 기사는 제목·날짜·키워드를 볼 필요가 없다 (대부분이 여기서 끝난다)
    if (known.has(key)) continue;
    const title = tag(block, "title");
    if (!title) continue;
    const date = Date.parse(tag(block, "pubDate") || tag(block, "dc:date") || tag(block, "published") || tag(block, "updated"));
    if (date && now - date > MAX_AGE_MS) continue;
    if (source.keywordFilter && !SECURITY_KEYWORDS.test(`${title} ${tag(block, "description")}`)) continue;
    if (keywordExclusion(title)) continue;
    items.push({ key, title: title.slice(0, 80), source: source.id });
  }
  return items;
}

// 태그별 정규식은 한 번만 만든다 (항목마다 새로 만들면 CPU 시간이 크게 는다)
const TAGS = new Map<string, RegExp>();
function tag(block: string, name: string): string {
  let re = TAGS.get(name);
  if (!re) TAGS.set(name, (re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`)));
  const m = block.match(re);
  if (!m) return "";
  return m[1]
    .replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

/** 32비트 FNV-1a를 두 번(시드 다르게) → 짧은 키. 수천 건 규모에서 충돌은 사실상 없다 */
function hash(s: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x5bd1e995);
  }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36);
}
