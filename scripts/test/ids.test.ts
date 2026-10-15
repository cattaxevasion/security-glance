// id 테스트. 2026-10-15에 주소 정리 함수가 바뀌면서 새 토픽이 모두 같은 id를 받은 버그가 다시 나지 않게.
//   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { topicIdFor } from "../collect/topics";
import { idFor, normalizeUrl, sha1 } from "../collect/util";

test("토픽 id는 기사마다 다르다", () => {
  const ids = new Set(["a1b2c3", "d4e5f6", "0011223344556677"].map(topicIdFor));
  assert.equal(ids.size, 3);
  assert.notEqual(topicIdFor("a1b2c3"), sha1(""));
});

test("토픽 id는 예전 방식과 같다 (이미 공유된 링크가 깨지지 않게)", () => {
  assert.equal(topicIdFor("a1b2c3"), sha1("topic:a1b2c3"));
});

test("기사 id: http·https 주소만, 추적용 쿼리는 무시", () => {
  assert.equal(normalizeUrl("javascript:alert(1)"), "");
  assert.equal(normalizeUrl("topic:abc"), "");
  assert.equal(idFor("https://example.com/a?utm_source=x#top"), idFor("https://example.com/a"));
  assert.notEqual(idFor("https://example.com/a"), idFor("https://example.com/b"));
});
