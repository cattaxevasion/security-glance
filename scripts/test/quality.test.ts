// 콘텐츠 품질 규칙 테스트: 주간 정리 글 알아보기, 요약 속 연도 의심, 브리핑 반복 방지, HTML 문자 참조.
//   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Briefing, Topic } from "../../shared/types";
import { freshCandidates } from "../collect/briefing";
import { suspiciousYear } from "../collect/quality";
import { isDigest } from "../collect/topics";
import { decodeEntities } from "../collect/util";

test("주간 정리 글: 여러 사건을 모은 글만 (JPCERT Weekly Report·월례 패치는 한 사건)", () => {
  for (const title of [
    "26th October – Threat Intelligence Report",
    "⚡ Weekly Recap: This2Shell, That2Shell, Everything's an RCE?",
    "ThreatsDay: AI Secrets Leak, PingCAP Source Theft",
    "In Other News: Tor Exit Relays Hijacked, Banks Spot Rogue AI Agents",
    "AI Threat Landscape Digest: July–August 2026",
  ])
    assert.equal(isDigest({ title }), true, title);
  for (const title of [
    "Weekly Report: VeloCloud OrchestratorにSQLインジェクションの脆弱性",
    "MS、月例更新で1400件以上の脆弱性に対応 - 一部悪用も",
    "Ivanti Connect Secure zero-day exploited",
  ])
    assert.equal(isDigest({ title }), false, title);
});

const item = (publishedAt: string, title: string, ko: string, ja: string, en: string) => ({
  publishedAt,
  title,
  summaryKo: [ko],
  summaryJa: [ja],
  summaryEn: [en],
});

test("요약 속 연도: 제목에 없는 이전 연도, 언어마다 다른 연도는 의심", () => {
  assert.equal(
    suspiciousYear(item("2026-10-07T22:06:06Z", "IDCFにランサムウェア", "2025년 10월 7일 새벽 공격", "2025年10月7日未明", "On October 7, 2025")),
    true,
  );
  assert.equal(suspiciousYear(item("2026-10-28T00:00:00Z", "Fuji TV", "2025년 10월", "2026年10月", "October 2026")), true);
  assert.equal(suspiciousYear(item("2026-10-28T00:00:00Z", "Breach", "2026년 10월 공격", "2026年10月", "October 2026")), false);
  assert.equal(suspiciousYear(item("2026-10-28T00:00:00Z", "Breach", "피해 수는 약 3만 명", "約3万人", "about 30,000")), false);
  // 제목에 나온 이전 연도는 정상
  assert.equal(suspiciousYear(item("2026-10-28T00:00:00Z", "2025 breach report", "2025년 사고", "2025年の事故", "2025 incident")), false);
});

test("브리핑: 최근 브리핑에 나온 토픽은 새 기사가 2건 이상일 때만 다시 후보", () => {
  const t = (id: string, articleIds: string[]) => ({ id, articleIds }) as unknown as Topic;
  const prev = [
    { date: "2026-10-28", generatedAt: "2026-10-27T21:00:00Z", items: [{ topicId: "old" }, { topicId: "grew" }] },
  ] as unknown as Briefing[];
  const collected: Record<string, string> = {
    a1: "2026-10-27T10:00:00Z",
    a2: "2026-10-28T03:00:00Z", // 브리핑 뒤 1건
    b1: "2026-10-28T03:00:00Z",
    b2: "2026-10-28T05:00:00Z", // 브리핑 뒤 2건
  };
  const pool = [t("old", ["a1", "a2"]), t("grew", ["b1", "b2"]), t("x", []), t("y", []), t("z", [])];
  const ids = freshCandidates(pool, prev, "2026-10-29", (id) => collected[id] ?? "").map((x) => x.id);
  assert.deepEqual(ids, ["grew", "x", "y", "z"]);
  // 빼면 3개보다 적어지면 빼지 않는다
  assert.equal(freshCandidates(pool.slice(0, 3), prev, "2026-10-29", (id) => collected[id] ?? "").length, 3);
});

test("HTML 문자 참조를 글자로", () => {
  assert.equal(decodeEntities("&#x5b;Guest Diary&#x5d; Who&#x3f;"), "[Guest Diary] Who?");
  assert.equal(decodeEntities("伊藤忠サイバー&amp;インテリジェンス"), "伊藤忠サイバー&インテリジェンス");
  assert.equal(decodeEntities("A &unknown; B"), "A &unknown; B");
});
