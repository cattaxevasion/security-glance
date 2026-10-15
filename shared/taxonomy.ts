// 고정 분류 태그. LLM은 이 목록에서만 고른다(자유 생성 금지).
// 수집 스크립트와 화면이 같은 목록을 쓴다.

// 한국은 2026-10-15에 범위에서 뺐다 (정보 밀도가 낮아 일본·국제에 집중)
export const REGIONS = ["INTL", "JP"] as const;
export type Region = (typeof REGIONS)[number];

export const REGION_LABEL: Record<Region, string> = {
  INTL: "국제",
  JP: "일본",
};

export const SOURCE_KINDS = ["news", "vendor", "cert"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

/** 벤더 분석 글에서 뽑는 IoC 종류 */
export const IOC_TYPES = ["IP", "도메인", "URL", "파일 해시", "파일명", "레지스트리", "이메일", "인증서", "YARA", "Sigma"] as const;
export type IocType = (typeof IOC_TYPES)[number];

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
  "유통·서비스",
  "에너지·기반시설",
  "개인",
] as const;

export const NATURES = ["사건", "취약점 공지", "정책·법규", "체포·수사", "연구·리포트", "업계 동향"] as const;

export type AttackType = (typeof ATTACK_TYPES)[number];
export type Sector = (typeof SECTORS)[number];
export type Nature = (typeof NATURES)[number];
