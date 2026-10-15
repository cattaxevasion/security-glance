// 기사 본문 추출. 본문은 요약 입력으로만 쓰고 어디에도 저장하지 않는다.
import { Readability } from "@mozilla/readability";
import { JSDOM, VirtualConsole } from "jsdom";
import robotsParser from "robots-parser";
import { USER_AGENT, fetchText } from "./util";

const robotsCache = new Map<string, Promise<ReturnType<typeof robotsParser> | null>>();

function robotsFor(url: string) {
  const origin = new URL(url).origin;
  let cached = robotsCache.get(origin);
  if (!cached) {
    const robotsUrl = `${origin}/robots.txt`;
    cached = fetchText(robotsUrl, 10000)
      .then((txt) => robotsParser(robotsUrl, txt))
      .catch(() => null); // robots.txt가 없거나 못 읽으면 제한 없음으로 본다
    robotsCache.set(origin, cached);
  }
  return cached;
}

/** 본문 최대 길이. 뉴스는 앞부분이면 충분하고, 벤더 분석 글은 기법·IoC가 뒤쪽에 있어 더 길게 읽는다. */
export const BODY_CHARS = { news: 6000, long: 14000 };

export async function extractArticle(url: string, maxChars = BODY_CHARS.news): Promise<string | null> {
  try {
    const robots = await robotsFor(url);
    if (robots && robots.isAllowed(url, USER_AGENT) === false) return null;

    const html = await fetchText(url, 20000);
    const virtualConsole = new VirtualConsole(); // CSS 파싱 경고 등 소음 차단
    const dom = new JSDOM(html, { url, virtualConsole });
    const article = new Readability(dom.window.document).parse();
    dom.window.close();
    const text = (article?.textContent ?? "").replace(/\s+/g, " ").trim();
    // 너무 짧으면 차단 페이지·유료 안내일 가능성이 높다
    if (text.length < 300) return null;
    return text.slice(0, maxChars);
  } catch {
    return null;
  }
}
