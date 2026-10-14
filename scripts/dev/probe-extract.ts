// 소스별로 최신 기사 1건씩 본문 추출이 되는지 확인하는 개발용 도구
import { readFile } from "node:fs/promises";
import { extractArticle } from "../collect/article";
import { fetchFeeds, type Source } from "../collect/rss";

const { sources } = JSON.parse(await readFile("sources.json", "utf8")) as { sources: Source[] };
const { items } = await fetchFeeds(sources);
for (const s of sources) {
  const item = items.find((i) => i.source.id === s.id);
  if (!item) { console.log(`--   ${s.name}: 항목 없음`); continue; }
  const body = await extractArticle(item.url);
  console.log(`${body ? "OK  " : "NONE"} ${s.name.padEnd(22)} body=${body?.length ?? 0} snippet=${item.snippet.length} ${body ? "| " + body.slice(0, 50) : ""}`);
}
