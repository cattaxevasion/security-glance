// 토픽 링크 미리보기 이미지(1200×630): 들어갈 글자와 파일 이름.
// 공유 페이지(TopicShare.astro)와 이미지 생성(scripts/og/build.tsx)이 같이 써서 이름이 늘 맞는다.
// 파일 이름에 내용 해시를 넣는다: 제목·출처 수가 바뀌면 주소가 바뀌어 메신저가 예전 이미지를 계속 보여주지 않는다.
import { createHash } from "node:crypto";
import type { Topic } from "../../shared/types";
import { REGION_LABELS, STRINGS, tagLabel, type Lang } from "../i18n";
import { shortHeadline, titleOf } from "../components/text";

/** 디자인을 바꾸면 올린다 (모든 이미지를 다시 그리게) */
export const OG_VERSION = 1;

export interface OgText {
  lang: Lang;
  nature: Topic["nature"];
  natureLabel: string;
  regions: string;
  sources: string;
  date: string;
  title: string;
}

export function ogText(lang: Lang, topic: Topic): OgText {
  const t = STRINGS[lang];
  // 날짜는 일본 시간 기준 (2026.10.15)
  const d = new Date(Date.parse(topic.firstSeen) + 9 * 3600_000).toISOString();
  return {
    lang,
    nature: topic.nature,
    natureLabel: tagLabel(lang, topic.nature),
    regions: topic.regions.map((r) => REGION_LABELS[lang][r]).join(" · "),
    sources: t.sourcesCount(topic.sources.length),
    date: `${d.slice(0, 4)}.${d.slice(5, 7)}.${d.slice(8, 10)}`,
    title: shortHeadline(lang, titleOf(lang, topic)),
  };
}

export function ogHash(text: OgText): string {
  return createHash("sha1").update(JSON.stringify([OG_VERSION, text])).digest("hex").slice(0, 10);
}

/** 사이트 기준 경로 (public/ 아래에 생긴다) */
export function ogFile(lang: Lang, topic: Topic): string {
  return `og/${lang}/${topic.id}-${ogHash(ogText(lang, topic))}.jpg`;
}
