// 화면 도우미(src/components/text.ts)의 영어 화면 규칙과 토픽 파일 나누기·합치기 테스트.
//   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { hasNonEnglish } from "../../shared/lang";
import { joinTopics, splitTopics } from "../../shared/topic-files";
import type { Topic } from "../../shared/types";
import { STRINGS } from "../../src/i18n";
import { namesOf, pendingEn, setNameEnglish, summaryOf, textOf, titleOf } from "../../src/components/text";

const base = { titleKo: "다이이치생명(第一生命保険) 정보 유출", titleJa: "第一生命保険で情報漏えい", summaryKo: ["요약"], summaryJa: ["要約"] };

test("영어 화면: 영어 제목·요약을 쓰고, 섞인 글자는 마지막 수단으로 지운다", () => {
  const x = { ...base, titleEn: "Dai-ichi Life data breach", summaryEn: ["One.", "Two (第一生命保険)."] };
  assert.equal(titleOf("en", x), "Dai-ichi Life data breach");
  const s = summaryOf("en", x);
  assert.equal(s.length, 2);
  for (const line of s) assert.equal(hasNonEnglish(line), false, line);
});

test("영어 화면: 영어가 아직 없으면 영어 원제목, 그것도 아니면 안내 문구 (한국어·일본어를 대신 쓰지 않는다)", () => {
  const empty = { ...base, titleEn: "", summaryEn: [] };
  assert.equal(titleOf("en", empty, "Ivanti flaw exploited"), "Ivanti flaw exploited");
  assert.equal(titleOf("en", empty, "第一生命保険で情報漏えい"), STRINGS.en.enPending);
  assert.equal(titleOf("en", empty), STRINGS.en.enPending);
  assert.deepEqual(summaryOf("en", empty), []);
  // 영어 필드가 아예 없는 이전 데이터
  assert.equal(titleOf("en", base), STRINGS.en.enPending);
});

test("브리핑 문장: 영어가 비면 안내 문구, 다른 언어는 그대로", () => {
  assert.equal(pendingEn("en", textOf("en", "한국어", "日本語", "")), STRINGS.en.enPending);
  assert.equal(pendingEn("en", textOf("en", "한국어", "日本語", "English")), "English");
  assert.equal(pendingEn("ko", textOf("ko", "한국어", "日本語", "")), "한국어");
  assert.equal(pendingEn("ja", textOf("ja", "한국어", "日本語")), "日本語");
});

test("영어 화면의 이름: 일본어 이름은 영어 표기로, 표기가 없으면 숨긴다", () => {
  setNameEnglish({ 第一生命保険: "Dai-ichi Life Insurance" });
  assert.deepEqual(namesOf("en", ["第一生命保険", "LockBit", "ちばぎん商店", "국민은행"]), [
    "Dai-ichi Life Insurance",
    "LockBit",
  ]);
  // 영어 화면에는 원문을 붙이지 않는다
  assert.deepEqual(namesOf("en", ["第一生命保険"], true), ["Dai-ichi Life Insurance"]);
});

test("토픽 파일 나누기·합치기: 세 언어를 다 합치면 원래대로, 한 언어만 받으면 나머지는 빈 칸", () => {
  const t = {
    id: "t1",
    titleKo: "제목",
    titleJa: "タイトル",
    titleEn: "Title",
    summaryKo: ["가"],
    summaryJa: ["あ"],
    summaryEn: ["A"],
    regions: ["JP"],
    importance: 10,
  } as unknown as Topic;
  const { core, texts } = splitTopics([t]);
  assert.equal("titleKo" in core[0], false);
  assert.deepEqual(joinTopics(core, texts)[0], t);
  const onlyEn = joinTopics(core, { en: texts.en })[0];
  assert.equal(onlyEn.titleEn, "Title");
  assert.equal(onlyEn.titleKo, "");
  assert.deepEqual(onlyEn.summaryJa, []);
});
