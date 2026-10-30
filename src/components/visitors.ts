// 방문자 수: 사이트를 열 때마다 1을 더하고 오늘(일본 시간)·누적을 받아 온다 (visits/ Worker).
// Worker에는 날짜별 숫자만 남는다 (쿠키·IP 없음). 로컬 미리보기에서는 더하지 않고 읽기만 한다.
import { useEffect, useState } from "react";

/** visits Worker 주소. 비어 있으면 세지도 보여주지도 않는다 */
export const VISITS_URL = "https://security-glance-visits.581520-h.workers.dev";
const SITE_ORIGIN = "https://cattaxevasion.github.io";

export interface Visits {
  today: number;
  total: number;
}

// 페이지를 한 번 열 때 한 번만 (화면 전환·다시 그리기로 또 세지 않게)
let request: Promise<Visits | null> | null = null;

function fetchVisits(): Promise<Visits | null> {
  if (!VISITS_URL) return Promise.resolve(null);
  const count = location.origin === SITE_ORIGIN;
  request ??= fetch(`${VISITS_URL}/${count ? "hit" : "stats"}`, { method: count ? "POST" : "GET" })
    .then((r) => (r.ok ? (r.json() as Promise<Visits>) : null))
    .catch(() => null);
  return request;
}

/** 못 받으면 null (그때는 표시하지 않는다) */
export function useVisitors(): Visits | null {
  const [v, setV] = useState<Visits | null>(null);
  useEffect(() => {
    let alive = true;
    fetchVisits().then((x) => alive && setV(x));
    return () => {
      alive = false;
    };
  }, []);
  return v;
}
