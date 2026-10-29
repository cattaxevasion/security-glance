// 고위험 CVE 점수 고르기 테스트.
//   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { pickCvss } from "../collect/vulns";

const metric = (baseScore: number, baseSeverity: string) => ({ cvssData: { baseScore, baseSeverity } });

test("pickCvss: NVD·제보 기관 점수가 함께 있으면 물어본 등급의 점수를 고른다 (HIGH로 고른 목록에 MEDIUM이 섞이지 않게)", () => {
  const metrics = { cvssMetricV31: [metric(6.6, "MEDIUM"), metric(7.2, "HIGH")] };
  assert.deepEqual(pickCvss(metrics, "HIGH"), { score: 7.2, severity: "HIGH" });
  assert.deepEqual(pickCvss(metrics, "CRITICAL"), { score: 6.6, severity: "MEDIUM" });
});

test("pickCvss: v3.1이 있으면 v4보다 먼저", () => {
  const metrics = { cvssMetricV40: [metric(5.3, "MEDIUM")], cvssMetricV31: [metric(9.8, "CRITICAL")] };
  assert.deepEqual(pickCvss(metrics, "CRITICAL"), { score: 9.8, severity: "CRITICAL" });
  assert.deepEqual(pickCvss(undefined, "HIGH"), { score: null, severity: null });
});
