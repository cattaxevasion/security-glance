// 후보 RSS URL이 실제로 파싱되는지 확인하는 개발용 도구
// 사용법: npx tsx scripts/dev/probe-feeds.ts <url> [url...]
import Parser from "rss-parser";

const parser = new Parser({ timeout: 15000, headers: { "User-Agent": "security-glance/0.1 (+https://github.com)" } });

for (const url of process.argv.slice(2)) {
  try {
    const feed = await parser.parseURL(url);
    const first = feed.items[0];
    console.log(`OK   ${url}\n     "${feed.title}" items=${feed.items.length} first="${first?.title?.slice(0, 60)}" date=${first?.isoDate} snippetLen=${(first?.contentSnippet ?? "").length}`);
  } catch (e) {
    console.log(`FAIL ${url}\n     ${(e as Error).message.slice(0, 120)}`);
  }
}
