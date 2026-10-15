// 빌드할 때 토픽 데이터를 읽는다 (토픽 공유 페이지용). Actions에서는 수집 직후라 화면용 파일이 있다.
import { existsSync, readFileSync } from "node:fs";
import type { Topic } from "../../shared/types";

const read = (p: string): Topic[] => (existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as Topic[]) : []);

export function buildTopics(): Topic[] {
  const recent = read("public/data/topics-recent.json");
  // 오래된 로컬 데이터에는 나눈 파일이 없어서 전체본을 쓴다
  return recent.length ? [...recent, ...read("public/data/topics-archive.json")] : read("public/data/topics.json");
}
