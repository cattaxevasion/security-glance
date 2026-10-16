// 속보 띠: 최근 6시간 안에 처음 보도된 사건 헤드라인을 하나씩 돌려 보여준다. 누르면 그 토픽 상세가 열린다.
// 휴대폰은 헤더 바로 아래 화면 폭 검은 띠(strip), 데스크톱은 브리핑 배너 머리에 붙은 띠(banner).
import { makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import { useEffect, useMemo, useState } from "react";
import { JAPANESE } from "../../shared/lang";
import type { Topic } from "../../shared/types";
import { STRINGS, type Lang } from "../i18n";
import { relativeTime } from "./format";
import { useMotion } from "./motion";
import { titleOf } from "./text";

const HOURS = 6;
const MAX = 3;
const ROTATE_MS = 6000;

export function breakingTopics(topics: Topic[], now = Date.now()): Topic[] {
  const since = now - HOURS * 3600_000;
  return topics
    .filter((x) => x.nature === "사건" && Date.parse(x.firstSeen) >= since)
    .sort((a, b) => b.firstSeen.localeCompare(a.firstSeen))
    .slice(0, MAX);
}

// 괄호 속 일본어 원문: 일본어 글자 범위는 shared/lang.ts의 것을 그대로 쓴다
const ORIGINAL = new RegExp(String.raw`\s*\([^)]*[${JAPANESE.source.slice(1, -1)}][^)]*\)`, "g");

/** 한국어 헤드라인에서 괄호 속 일본어 원문을 뺀다 (띠는 짧게. 카드·상세에는 그대로 남는다) */
export function shortHeadline(lang: Lang, text: string): string {
  return lang === "ko" ? text.replace(ORIGINAL, "") : text;
}

const useStyles = makeStyles({
  bar: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    boxSizing: "border-box",
    border: "none",
    font: "inherit",
    textAlign: "left",
    color: "#fff",
    cursor: "pointer",
    position: "relative",
    zIndex: 1,
    ":focus-visible": { outline: "2px solid #fff", outlineOffset: "-3px" },
  },
  // 휴대폰: 헤더 아래 화면 폭 전체, 헤드라인 두 줄까지
  strip: {
    alignItems: "flex-start",
    minHeight: "44px",
    margin: "0 -16px",
    width: "calc(100% + 32px)",
    padding: "9px 16px",
    backgroundColor: "#111318",
    ":hover": { backgroundColor: "#1a1d24" },
  },
  // 데스크톱: 배너 위쪽을 어둡게 잘라 붙인다 (배너 안쪽 여백만큼 바깥으로)
  banner: {
    height: "42px",
    margin: "-28px -32px 22px",
    width: "calc(100% + 64px)",
    padding: "0 32px",
    backgroundColor: "rgba(6, 10, 24, 0.42)",
    borderBottom: "1px solid rgba(255, 255, 255, 0.10)",
    ":hover": { backgroundColor: "rgba(6, 10, 24, 0.55)" },
    "@media (max-width: 640px)": { margin: "-20px -18px 16px", width: "calc(100% + 36px)", padding: "0 18px" },
  },
  label: {
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    fontSize: tokens.fontSizeBase200,
    lineHeight: "20px",
    fontWeight: tokens.fontWeightBold,
    letterSpacing: "0.03em",
    color: "#ff7a7a",
  },
  dot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    backgroundColor: "#ff3b30",
    boxShadow: "0 0 0 3px rgba(255, 59, 48, 0.3)",
  },
  sep: { flexShrink: 0, width: "1px", height: "14px", backgroundColor: "rgba(255, 255, 255, 0.22)" },
  headline: {
    flex: 1,
    minWidth: 0,
    fontSize: tokens.fontSizeBase300,
    lineHeight: "20px",
    fontWeight: tokens.fontWeightSemibold,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  headlineTwo: {
    whiteSpace: "normal",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
  },
  meta: {
    flexShrink: 0,
    display: "flex",
    gap: "10px",
    fontSize: tokens.fontSizeBase200,
    lineHeight: "20px",
    color: "rgba(255, 255, 255, 0.62)",
    fontVariantNumeric: "tabular-nums",
  },
  metaStack: { flexDirection: "column", alignItems: "flex-end", gap: 0, lineHeight: "18px" },
});

export function BreakingBar(p: { lang: Lang; topics: Topic[]; onOpen: (id: string) => void; variant: "strip" | "banner" }) {
  const s = useStyles();
  const m = useMotion();
  const t = STRINGS[p.lang];
  const [tick, setTick] = useState(0);
  // 6초마다 다음 헤드라인. 1분(10틱)마다 다시 골라 6시간이 지난 건 빠지게 한다
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), ROTATE_MS);
    return () => window.clearInterval(id);
  }, []);
  const minute = Math.floor(tick / 10);
  const items = useMemo(() => breakingTopics(p.topics), [p.topics, minute]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!items.length) return null;
  const i = tick % items.length;
  const x = items[i];
  const title = shortHeadline(p.lang, titleOf(p.lang, x));
  const strip = p.variant === "strip";
  return (
    <button
      type="button"
      className={mergeClasses(s.bar, strip ? s.strip : s.banner)}
      onClick={() => p.onOpen(x.id)}
      aria-label={`${t.breaking}: ${title}`}
    >
      <span className={s.label}>
        <span className={s.dot} aria-hidden />
        {t.breaking}
      </span>
      {!strip && <span className={s.sep} aria-hidden />}
      <span key={x.id} className={mergeClasses(s.headline, strip && s.headlineTwo, m.fade)}>
        {title}
      </span>
      <span className={mergeClasses(s.meta, strip && s.metaStack)}>
        <span>{relativeTime(p.lang, x.firstSeen)}</span>
        {items.length > 1 && (
          <span>
            {i + 1}/{items.length}
          </span>
        )}
      </span>
    </button>
  );
}
