// 빌드할 때 토픽 데이터를 읽는다 (토픽 공유 페이지용). Actions에서는 수집 직후라 화면용 파일이 있다.
import { readSiteTopics } from "../../shared/topic-files-node";
import type { Topic } from "../../shared/types";

export function buildTopics(): Topic[] {
  return readSiteTopics();
}
