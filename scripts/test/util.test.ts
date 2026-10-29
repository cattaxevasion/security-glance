// 수집기 공용 도우미 테스트: 데이터 파일 읽기(깨진 파일은 멈춤), API 일시 오류 분류, 공개 로그용 오류 설명.
//   npm test
import Anthropic from "@anthropic-ai/sdk";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { describeError, isTransientApiError, readJson } from "../collect/util";

test("readJson: 없는 파일만 기본값, 깨진 파일은 오류 (빈 값으로 이어 가 data 브랜치를 덮어쓰지 않게)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sg-"));
  assert.deepEqual(await readJson(join(dir, "none.json"), { a: 1 }), { a: 1 });
  await writeFile(join(dir, "ok.json"), '{"b":2}');
  assert.deepEqual(await readJson(join(dir, "ok.json"), {}), { b: 2 });
  await writeFile(join(dir, "broken.json"), '{"b":');
  await assert.rejects(readJson(join(dir, "broken.json"), {}));
});

const apiError = (status: number) =>
  Anthropic.APIError.generate(status, { type: "error", error: { type: "x", message: "detail" } }, "detail", new Headers());

test("API 일시 오류(과부하·한도·서버·연결)만 일시 오류로 본다", () => {
  for (const s of [429, 500, 503, 529]) assert.equal(isTransientApiError(apiError(s)), true, String(s));
  for (const s of [400, 401, 403, 404]) assert.equal(isTransientApiError(apiError(s)), false, String(s));
  assert.equal(isTransientApiError(new Anthropic.APIConnectionError({ message: "reset" })), true);
  assert.equal(isTransientApiError(new Error("parse failed")), false);
});

test("공개 로그용 오류 설명: API 오류는 종류와 상태 코드만", () => {
  const d = describeError(apiError(429));
  assert.match(d, /429/);
  assert.doesNotMatch(d, /detail/);
  assert.equal(describeError(new Error("empty summary")), "empty summary");
});
