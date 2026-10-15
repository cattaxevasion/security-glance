// 지난 방문 이후 새 소식. 마지막 방문 시각은 이 브라우저에만 기억한다 (다른 기기와 공유하지 않음).
import { useEffect, useState } from "react";
import type { Topic } from "../../shared/types";

const KEY = "sg:lastVisit";

/** 이번 방문 전의 마지막 방문 시각. 처음 왔거나 저장소를 못 쓰면 null (그때는 '새 소식'을 표시하지 않는다) */
export function useLastVisit(): number | null {
  const [prev] = useState<number | null>(() => {
    try {
      const v = Number(localStorage.getItem(KEY));
      return v > 0 ? v : null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    const save = () => {
      try {
        localStorage.setItem(KEY, String(Date.now()));
      } catch {
        // 비공개 창 등에서 저장소를 못 쓰면 기억하지 않는다
      }
    };
    // 페이지를 숨기거나 떠날 때 '이번 방문'으로 기록한다 (보고 있는 동안에는 기준이 바뀌지 않게)
    const onVisibility = () => document.visibilityState === "hidden" && save();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", save);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", save);
    };
  }, []);
  return prev;
}

/** 지난 방문 뒤에 새로 수집된 기사가 있는 토픽인지 */
export function isFresh(t: Topic, since: number | null): boolean {
  if (since == null) return false;
  return Date.parse(t.collectedAt ?? t.firstSeen) > since;
}
