// 고정 분류 태그. LLM은 이 목록에서만 고른다(자유 생성 금지).
// 수집 스크립트와 화면이 같은 목록을 쓴다.

export const REGIONS = ["INTL", "JP", "KR"] as const;
export type Region = (typeof REGIONS)[number];

export const REGION_LABEL: Record<Region, string> = {
  INTL: "국제",
  JP: "일본",
  KR: "한국",
};

export const ATTACK_TYPES = [
  "랜섬웨어",
  "피싱",
  "정보유출",
  "취약점 악용",
  "제로데이",
  "공급망",
  "DDoS",
  "계정 탈취",
  "내부자",
  "악성코드",
] as const;

export const SECTORS = [
  "정부·공공",
  "금융",
  "의료",
  "제조",
  "통신",
  "교육",
  "IT·클라우드",
  "개인",
] as const;

export const NATURES = ["사건", "취약점 공지", "정책·법규", "체포·수사", "연구·리포트", "업계 동향"] as const;

export type AttackType = (typeof ATTACK_TYPES)[number];
export type Sector = (typeof SECTORS)[number];
export type Nature = (typeof NATURES)[number];
