// 언어 판별식과 마지막 수단(기계 변환) 테스트. 실제로 화면에 새어 나갔던 문장들을 예로 쓴다.
//   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  forceEn,
  forceJa,
  forceKo,
  hangulSegments,
  hasHangul,
  hasNonEnglish,
  hasRawJapanese,
  kanaToHangul,
  kanaToRomaji,
  nonEnglishSegments,
  rawJapaneseSegments,
} from "../../shared/lang";

test("한국어 문장 속 일본어를 잡는다", () => {
  for (const s of [
    "第一ライフグループ과 第一生命保険의 인사 시스템 불법 접근",
    "県サイト公開の障害者雇用参加企業一覧に個人情報 - 神奈川県",
    "EPARK 리ラク&에스테 예약 플랫폼",
    "「焼肉きんぐ」 개인정보 약 1079만 건 유출",
    "국산 WAF 「SiteGuard Server Edition」에 취약점", // 일본식 괄호만 있어도
  ])
    assert.equal(hasRawJapanese(s), true, s);
});

test("괄호 속 원문 병기와 한국어 구분 기호는 허용한다", () => {
  for (const s of [
    "다이이치생명(第一生命保険)의 직원 정보 유출",
    "가나가와현(神奈川県) 사이트",
    "미국·일본 공동 수사",
    "가나・다", // 가운뎃점
    "'야키니쿠 킹(焼肉きんぐ)' 개인정보 유출",
    "Microsoft, 10월 패치로 취약점 172개 수정",
  ])
    assert.equal(hasRawJapanese(s), false, s);
});

test("일본어 문장 속 한글을 잡는다", () => {
  assert.equal(hasHangul("KB국민은行に不正アクセス"), true);
  assert.equal(hasHangul("物語コーポレーションに不正アクセス"), false);
  assert.deepEqual(hangulSegments("KB국민은행 및 신한은행に攻撃"), ["국민은행 및 신한은행"]);
});

test("다시 고쳐 달라고 짚어 줄 부분은 괄호 밖만", () => {
  assert.deepEqual(rawJapaneseSegments("다이이치생명(第一生命保険)과 ちばぎん商店 사이트"), ["ちばぎん商店"]);
  assert.deepEqual(rawJapaneseSegments("「바이트루」에서 유출"), ["「", "」"]);
});

test("가나 → 한글 소리", () => {
  assert.equal(kanaToHangul("ライフグループ"), "라이후구루푸");
  assert.equal(kanaToHangul("バイトル"), "바이토루");
  assert.equal(kanaToHangul("ちばぎん"), "치바긴");
  assert.equal(kanaToHangul("ディップ"), "딥푸");
  assert.equal(kanaToHangul("ショップ"), "숍푸");
});

test("마지막 수단을 거친 문장은 언제나 검사를 통과한다", () => {
  for (const s of [
    "第一ライフグループ과 第一生命保険의 인사 시스템 불법 접근",
    "損保ジャパン、大和証券・シチズンと同じ委託先への不正アクセスで約6万件漏えいか",
    "온라인 카지노 관련 콘텐츠 표시 — 지바은행 자회사 ちばぎん商店 기업 사이트 무단 접근",
    "경찰청 「사이버경찰국 소식지」, 정보 유출 주의",
    "다이이치생명(第一生命保険)의 직원 정보",
  ]) {
    const out = forceKo(s);
    assert.equal(hasRawJapanese(out), false, `${s} → ${out}`);
  }
  assert.equal(forceKo("경찰청 「사이버경찰국 소식지」"), "경찰청 '사이버경찰국 소식지'");
  assert.equal(forceKo("자회사 ちばぎん商店 사이트"), "자회사 치바긴(ちばぎん商店) 사이트");

  for (const s of ["KB국민은행に不正アクセス", "韓国の신한은행で障害"]) assert.equal(hasHangul(forceJa(s)), false, s);
});

test("이미 깨끗한 문장은 마지막 수단이 바꾸지 않는다", () => {
  const ko = "다이이치생명(第一生命保険) 직원 정보 약 12만 명분 유출 가능성";
  assert.equal(forceKo(ko), ko);
  const ja = "第一生命保険の人事システムに不正アクセス";
  assert.equal(forceJa(ja), ja);
});

test("영어 문장 속 한글·일본어·전각 기호를 잡는다 (괄호 속 원문도)", () => {
  for (const s of [
    "Data breach at Dai-ichi Life (第一生命保険)", // 영어는 괄호 원문도 허용하지 않는다
    "KB국민은행 hit by DDoS",
    "Ransomware attack on バイトル operator",
    "Unauthorized access at 「Yakiniku King」",
    "Patch released、update now",
    "Ivanti ＣＶＥ flaw", // 전각 영문
    "ｱｸｾｽ", // 반각 가나
  ])
    assert.equal(hasNonEnglish(s), true, s);
});

test("보통 영어 문장과 기호는 통과한다", () => {
  for (const s of [
    "Microsoft fixes 172 flaws in October Patch Tuesday",
    "Dai-ichi Life Insurance reports unauthorized access to HR system",
    "U.S. · Japan joint operation — 3 arrested (CVE-2026-1234)",
    "Café “Smart” devices’ firmware: 10% affected, €2M fine",
    "",
  ])
    assert.equal(hasNonEnglish(s), false, s);
  assert.deepEqual(nonEnglishSegments("Hit at 第一生命 and 국민은행"), ["第一生命", "국민은행"]);
});

test("가나 → 로마자", () => {
  assert.equal(kanaToRomaji("バイトル"), "baitoru");
  assert.equal(kanaToRomaji("ちばぎん"), "chibagin");
  assert.equal(kanaToRomaji("ショップ"), "shoppu");
  assert.equal(kanaToRomaji("マッチ"), "matchi");
  assert.equal(kanaToRomaji("ファンケル"), "fankeru");
});

test("영어 마지막 수단을 거친 문장은 언제나 검사를 통과한다", () => {
  for (const s of [
    "Data breach at 第一生命保険 (第一生命保険)",
    "「焼肉きんぐ」 leaks 1,079万 records",
    "KB국민은행 hit by DDoS、patched。",
    "Ivanti ＣＶＥ－２０２６－１２３４ flaw",
    "損保ジャパン、大和証券・シチズンと同じ委託先への不正アクセスで約6万件漏えいか",
  ]) {
    const out = forceEn(s);
    assert.equal(hasNonEnglish(out), false, `${s} → ${out}`);
  }
  assert.equal(forceEn("Ivanti ＣＶＥ－２０２６－１２３４ flaw、patched。"), "Ivanti CVE-2026-1234 flaw, patched.");
  assert.equal(forceEn("Breach at バイトル site"), "Breach at Baitoru site");
});

test("이미 깨끗한 영어 문장은 마지막 수단이 바꾸지 않는다", () => {
  const en = "Dai-ichi Life Insurance reports unauthorized access to HR system (about 120,000 records)";
  assert.equal(forceEn(en), en);
});
