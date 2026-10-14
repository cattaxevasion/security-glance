import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const fn = (e: MediaQueryListEvent) => setMatch(e.matches);
    setMatch(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [query]);
  return match;
}

/** Fluent 2 기준: 640px 이하에서는 탐색이 오버레이로 바뀐다 */
export const useNarrow = () => useMediaQuery("(max-width: 640px)");
export const usePrefersDark = () => useMediaQuery("(prefers-color-scheme: dark)");

/** 브라우저 저장소에 기억하는 불리언 (접힘 상태 같은 개인 설정) */
export function useStoredFlag(key: string, initial: boolean): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      return v === null ? initial : v === "1";
    } catch {
      return initial;
    }
  });
  const set = (v: boolean) => {
    setValue(v);
    try {
      localStorage.setItem(key, v ? "1" : "0");
    } catch {
      // 저장 못 해도 화면 동작에는 문제없다
    }
  };
  return [value, set];
}
