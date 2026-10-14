// 개발용: API 키 없이 화면을 확인하기 위한 임시 news.json 생성.
// 실제 RSS 기사 + 키워드 기반 임시 태그. 요약은 RSS 요지를 잘라 넣은 것이라 실제 품질과 다르다.
// 결과는 gitignore된 news.dev.json에 쓰고, 개발 서버(npm run dev)에서만 읽는다.
import { readFile } from "node:fs/promises";
import { ATTACK_TYPES, type AttackType } from "../../shared/taxonomy";
import type { NewsItem } from "../../shared/types";
import { fetchFeeds, type Source } from "../collect/rss";
import { idFor, writeJson } from "../collect/util";

const KEYWORDS: Record<AttackType, RegExp> = {
  랜섬웨어: /ransom|ランサム|랜섬/i,
  피싱: /phish|フィッシング|피싱|스미싱/i,
  정보유출: /leak|breach|stolen|流出|漏えい|유출/i,
  "취약점 악용": /exploit|vulnerab|脆弱性|취약점/i,
  제로데이: /zero-day|0-day|ゼロデイ|제로데이/i,
  공급망: /supply chain|サプライチェーン|공급망/i,
  DDoS: /ddos|디도스/i,
  "계정 탈취": /account takeover|credential|不正ログイン|계정 탈취/i,
  내부자: /insider|내부자/i,
  악성코드: /malware|trojan|マルウェア|악성코드/i,
};

const { sources } = JSON.parse(await readFile("sources.json", "utf8")) as { sources: Source[] };
const { items } = await fetchFeeds(sources);
const out: NewsItem[] = items.slice(0, 160).map((raw, i) => {
  const text = `${raw.title} ${raw.snippet}`;
  return {
    id: idFor(raw.url),
    url: raw.url,
    title: raw.title,
    titleKo: raw.title,
    sourceId: raw.source.id,
    sourceName: raw.source.name,
    sourceRegion: raw.source.region,
    publishedAt: raw.publishedAt,
    collectedAt: new Date().toISOString(),
    regions: [raw.source.region],
    summary: raw.snippet ? [raw.snippet.slice(0, 140)] : ["(개발용 샘플: 요약은 API 키 연결 후 생성돼요)"],
    socPoint: i % 3 === 0 ? "(개발용 샘플 문구) 실제 데이터에서는 탐지에 볼 로그나 지표가 여기에 들어가요." : null,
    attackTypes: ATTACK_TYPES.filter((t) => KEYWORDS[t].test(text)).slice(0, 3),
    sectors: [],
    nature: /CVE-|脆弱性|취약점|vulnerab/i.test(text) ? "취약점 공지" : "사건",
    entities: { cves: [...new Set(text.match(/CVE-\d{4}-\d{4,}/g) ?? [])], actors: [], orgs: [] },
    basis: raw.snippet ? "요지" : "제목",
  };
});
out.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
await writeJson("public/data/news.dev.json", out);
console.log(`fixture ${out.length}건`);
