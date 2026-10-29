// 토픽 공유 주소. 배포할 때 토픽마다 작은 페이지(/t/<id>/, 일본어는 /ja/t/<id>/)를 만들어
// 링크 미리보기(카카오톡·LINE·Slack 등)에 그 토픽의 제목·요약이 뜨게 하고, 열면 사이트의 그 토픽으로 보낸다.
import type { Lang } from "../i18n";

export function shareUrl(lang: Lang, id: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, "/");
  return new URL(`${base}${lang === "ko" ? "" : `${lang}/`}t/${id}/`, location.origin).href;
}
