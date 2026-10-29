// 화면용 토픽 파일을 언어별로 나눈다. 첫 화면에서 지금 언어의 글만 받게 (세 언어를 한 파일에 담으면 무겁다).
//   topics-{recent|archive}-core.json   언어와 무관한 부분 (태그, 엔티티, 기사 목록, 중요도, 날짜 …)
//   topics-{recent|archive}-{ko|ja|en}.json   토픽 id → 그 언어의 제목·요약
// 수집기가 나눠 쓰고, 화면·공유 페이지 빌드·검사 스크립트가 같은 함수로 다시 합친다.
import type { Topic } from "./types";

export const TEXT_LANGS = ["ko", "ja", "en"] as const;
export type TextLang = (typeof TEXT_LANGS)[number];

type TextField = "titleKo" | "titleJa" | "titleEn" | "summaryKo" | "summaryJa" | "summaryEn";
export type TopicCore = Omit<Topic, TextField>;
export type TopicTexts = Record<string, { title: string; summary: string[] }>;

const FIELDS: Record<TextLang, { title: TextField & `title${string}`; summary: TextField & `summary${string}` }> = {
  ko: { title: "titleKo", summary: "summaryKo" },
  ja: { title: "titleJa", summary: "summaryJa" },
  en: { title: "titleEn", summary: "summaryEn" },
};

export type TopicPart = "recent" | "archive";

/** public/data 아래 파일 이름 */
export const topicFile = (part: TopicPart, kind: "core" | TextLang) => `topics-${part}-${kind}.json`;

export function splitTopics(topics: Topic[]): { core: TopicCore[]; texts: Record<TextLang, TopicTexts> } {
  const texts = { ko: {}, ja: {}, en: {} } as Record<TextLang, TopicTexts>;
  const core = topics.map((t) => {
    const { titleKo: _a, titleJa: _b, titleEn: _c, summaryKo: _d, summaryJa: _e, summaryEn: _f, ...rest } = t;
    for (const l of TEXT_LANGS)
      texts[l][t.id] = { title: t[FIELDS[l].title] ?? "", summary: t[FIELDS[l].summary] ?? [] };
    return rest;
  });
  return { core, texts };
}

/** 나눈 파일을 다시 토픽으로. 받지 않은 언어의 칸은 비워 둔다 (화면 도우미가 그 언어를 고르지 않는다) */
export function joinTopics(core: TopicCore[], texts: Partial<Record<TextLang, TopicTexts>>): Topic[] {
  return core.map((c) => {
    const t = { ...c, titleKo: "", titleJa: "", titleEn: "", summaryKo: [], summaryJa: [], summaryEn: [] } as Topic;
    for (const l of TEXT_LANGS) {
      const x = texts[l]?.[c.id];
      if (!x) continue;
      t[FIELDS[l].title] = x.title;
      t[FIELDS[l].summary] = x.summary;
    }
    return t;
  });
}
