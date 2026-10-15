// Fluent 2 모션: 정해진 지속 시간·감속 곡선 토큰만 쓴다. 'prefers-reduced-motion'이면 모두 끈다.
import { makeStyles, tokens } from "@fluentui/react-components";
import { useEffect, useRef, useState } from "react";

const REDUCED = "@media (prefers-reduced-motion: reduce)";

export const useMotion = makeStyles({
  /** 아래에서 살짝 올라오며 나타나기 (목록 항목, 카드) */
  enter: {
    animationName: {
      from: { opacity: 0, transform: "translateY(8px)" },
      to: { opacity: 1, transform: "none" },
    },
    animationDuration: tokens.durationGentle,
    animationTimingFunction: tokens.curveDecelerateMid,
    animationFillMode: "both",
    [REDUCED]: { animationName: "none" },
  },
  /** 제자리에서 나타나기 (화면 전환, 패널 내용 교체) */
  fade: {
    animationName: { from: { opacity: 0 }, to: { opacity: 1 } },
    animationDuration: tokens.durationNormal,
    animationTimingFunction: tokens.curveEasyEase,
    animationFillMode: "both",
    [REDUCED]: { animationName: "none" },
  },
  /** 막대가 바닥에서 자라기 */
  grow: {
    transformOrigin: "bottom",
    animationName: { from: { transform: "scaleY(0)" }, to: { transform: "scaleY(1)" } },
    animationDuration: tokens.durationSlow,
    animationTimingFunction: tokens.curveDecelerateMax,
    animationFillMode: "both",
    [REDUCED]: { animationName: "none" },
  },
  /** 최근 24시간 표시용 점: 천천히 숨쉬듯 */
  pulse: {
    animationName: {
      "0%": { boxShadow: `0 0 0 0 ${tokens.colorPaletteRedBorder2}` },
      "70%": { boxShadow: "0 0 0 6px transparent" },
      "100%": { boxShadow: "0 0 0 0 transparent" },
    },
    animationDuration: "2s",
    animationTimingFunction: tokens.curveEasyEase,
    animationIterationCount: 3,
    [REDUCED]: { animationName: "none" },
  },
});

/** 목록 순차 등장 지연: 처음 몇 개만 계단식으로, 나머지는 바로 */
export function stagger(i: number, step = 28, max = 14): React.CSSProperties {
  return { animationDelay: `${Math.min(i, max) * step}ms` };
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** 숫자 카운트업 (감속 곡선). 값이 바뀌면 이전 값에서 이어서 움직인다. */
export function useCountUp(value: number, duration = 700): number {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0));
  const from = useRef(shown);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(a + (value - a) * eased);
      setShown(v);
      from.current = v;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return shown;
}
