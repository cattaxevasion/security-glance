// 피드 날짜가 올바른 시간대로 해석되는지 확인하는 개발용 도구
import { fetchFeeds } from "../collect/rss";
const src = { id: "dailysecu", name: "데일리시큐", region: "KR", lang: "ko", url: "https://www.dailysecu.com/rss/allArticle.xml" } as const;
const r = await fetchFeeds([src]);
console.log(r.items.slice(0, 2).map((i) => i.publishedAt), "now", new Date().toISOString());
