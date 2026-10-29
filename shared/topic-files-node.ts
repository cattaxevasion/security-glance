// 나눈 토픽 파일을 읽어 합친다 (Node 전용: 공유 페이지 빌드, 검사 스크립트). 화면은 App.tsx가 직접 받는다.
import { existsSync, readFileSync } from "node:fs";
import { joinTopics, TEXT_LANGS, topicFile, type TopicCore, type TopicPart, type TopicTexts } from "./topic-files";
import type { Topic } from "./types";

const read = <T>(p: string, d: T): T => (existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : d);

/**
 * 화면용 토픽 파일(최근·지난)을 세 언어 모두 합쳐서. 나눈 파일이 없는 오래된 로컬 데이터면
 * 나누기 전의 파일을, 그것도 없으면 수집기 내부용 전체본(topics.json)을 쓴다.
 */
export function readSiteTopics(dir = "public/data", parts: TopicPart[] = ["recent", "archive"]): Topic[] {
  if (existsSync(`${dir}/${topicFile("recent", "core")}`))
    return parts.flatMap((part) =>
      joinTopics(
        read<TopicCore[]>(`${dir}/${topicFile(part, "core")}`, []),
        Object.fromEntries(TEXT_LANGS.map((l) => [l, read<TopicTexts>(`${dir}/${topicFile(part, l)}`, {})])),
      ),
    );
  const legacy = parts.flatMap((part) => read<Topic[]>(`${dir}/topics-${part}.json`, []));
  return legacy.length ? legacy : read<Topic[]>(`${dir}/topics.json`, []);
}
