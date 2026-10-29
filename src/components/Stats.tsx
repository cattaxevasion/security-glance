// 요약 수치 줄 (인시던트·토픽·취약점 화면 공용): 대표 칸 하나(두 배 폭 + 배너 그라데이션 + 막대) + 색 숫자 칸들
import { Caption1, makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import { ChevronRightRegular } from "@fluentui/react-icons";
import type { CSSProperties, ReactNode } from "react";
import { LOCALE, STRINGS, type Lang } from "../i18n";
import { stagger, useCountUp, useMotion } from "./motion";

const useStyles = makeStyles({
  // 열 수는 칸 수에 따라 바뀌어서 CSS 변수로 받는다 (--cols: 넓은 화면, --cols-mid: 중간, --cols-sm: 휴대폰)
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(var(--cols), minmax(0, 1fr))",
    gap: "12px",
    margin: "16px 0 8px",
    "@media (max-width: 1100px)": { gridTemplateColumns: "repeat(var(--cols-mid), minmax(0, 1fr))" },
    // 휴대폰: 화면 폭 흰 띠 하나에 담고 칸은 박스 대신 가는 선으로 나눈다 (줄 첫 칸은 왼쪽 선 없음, 둘째 줄은 위 선)
    "@media (max-width: 640px)": {
      gridTemplateColumns: "repeat(var(--cols-sm), minmax(0, 1fr))",
      gap: "6px 0",
      margin: "16px -16px 8px",
      padding: "12px 16px",
      backgroundColor: tokens.colorNeutralBackground1,
      "& > :nth-child(2)": { borderLeftWidth: 0, paddingLeft: "2px" },
      '&[data-sm="2"] > :nth-child(4)': { borderLeftWidth: 0, paddingLeft: "2px" },
      '&[data-sm="2"] > :nth-child(n+4)': {
        borderTopWidth: "1px",
        borderTopStyle: "solid",
        borderTopColor: tokens.colorNeutralStroke2,
        paddingTop: "10px",
      },
    },
  },
  tile: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "2px",
    padding: "14px 16px",
    minWidth: 0,
    font: "inherit",
    textAlign: "left",
    color: tokens.colorNeutralForeground1,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusXLarge,
    boxShadow: tokens.shadow4,
    "@media (max-width: 640px)": {
      padding: "4px 12px",
      backgroundColor: "transparent",
      borderRadius: 0,
      boxShadow: "none",
      borderTopWidth: 0,
      borderRightWidth: 0,
      borderBottomWidth: 0,
      borderLeft: `1px solid ${tokens.colorNeutralStroke2}`,
    },
  },
  clickable: {
    cursor: "pointer",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover },
    "@media (max-width: 640px)": { borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0 },
    ":focus-visible": { outline: `2px solid ${tokens.colorStrokeFocus2}`, outlineOffset: "1px" },
  },
  label: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    width: "100%",
    color: tokens.colorNeutralForeground3,
    "@media (max-width: 640px)": { alignItems: "flex-start" },
  },
  chevron: {
    marginLeft: "auto",
    color: tokens.colorNeutralForeground3,
    "@media (max-width: 640px)": { display: "none" },
  },
  num: {
    fontSize: tokens.fontSizeHero700,
    lineHeight: tokens.lineHeightHero700,
    fontWeight: tokens.fontWeightSemibold,
    fontVariantNumeric: "tabular-nums",
  },
  text: {
    maxWidth: "100%",
    fontSize: tokens.fontSizeBase500,
    lineHeight: tokens.lineHeightHero700,
    fontWeight: tokens.fontWeightSemibold,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  sub: { color: tokens.colorNeutralForeground3 },
  // 대표 칸
  hero: {
    gridColumn: "span 2",
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    alignItems: "end",
    gap: "16px",
    padding: "14px 18px",
    border: "none",
    borderRadius: tokens.borderRadiusXLarge,
    color: "#fff",
    backgroundImage: "linear-gradient(120deg, #0c3b5e 0%, #0f548c 40%, #4a3a9c 100%)",
    boxShadow: tokens.shadow8,
    font: "inherit",
    textAlign: "left",
    "@media (max-width: 1100px)": { gridColumn: "1 / -1" },
    "@media (max-width: 640px)": { marginBottom: "6px" },
  },
  heroClickable: {
    cursor: "pointer",
    ":hover": { filter: "brightness(1.06)" },
    ":focus-visible": { outline: "2px solid #fff", outlineOffset: "-4px" },
  },
  heroText: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 },
  heroLabel: { color: "rgba(255,255,255,0.88)", fontWeight: tokens.fontWeightSemibold },
  heroSub: { color: "rgba(255,255,255,0.75)" },
  heroNum: { fontSize: "40px", lineHeight: "46px", fontWeight: tokens.fontWeightBold, fontVariantNumeric: "tabular-nums" },
  bars: {
    display: "flex",
    alignItems: "flex-end",
    gap: "3px",
    height: "52px",
    justifySelf: "end",
    width: "100%",
    maxWidth: "200px",
  },
  // 맨 오른쪽(가장 최근) 막대만 흰색
  bar: {
    flex: 1,
    minHeight: "3px",
    borderRadius: "2px 2px 0 0",
    backgroundColor: "rgba(255,255,255,0.35)",
    ":last-child": { backgroundColor: "#fff" },
  },
});

/** 요약 줄. tiles: 대표 칸을 뺀 칸 수 (열 수 계산용) */
export function StatGrid({ tiles, children }: { tiles: number; children: ReactNode }) {
  const s = useStyles();
  const style = {
    "--cols": tiles + 2,
    "--cols-mid": tiles,
    // 휴대폰: 4칸이면 2×2, 3칸 이하면 한 줄
    "--cols-sm": tiles === 4 ? 2 : tiles,
  } as CSSProperties;
  return (
    <div className={s.grid} style={style} data-sm={tiles === 4 ? 2 : tiles}>
      {children}
    </div>
  );
}

export interface Bar {
  key: string | number;
  /** 막대 이름 (예: 10월 14일, 오후 2시–오후 4시) */
  label: string;
  n: number;
}

export function HeroStat(p: {
  lang: Lang;
  label: string;
  value: number;
  sub?: string;
  bars: Bar[];
  onClick?: () => void;
}) {
  const s = useStyles();
  const m = useMotion();
  const t = STRINGS[p.lang];
  const n = useCountUp(p.value);
  const max = Math.max(1, ...p.bars.map((b) => b.n));
  const Tag = p.onClick ? "button" : "div";
  return (
    <Tag
      className={mergeClasses(s.hero, p.onClick && s.heroClickable, m.enter)}
      style={stagger(0, 50)}
      onClick={p.onClick}
    >
      <span className={s.heroText}>
        <Caption1 className={s.heroLabel}>{p.label}</Caption1>
        <span className={s.heroNum}>{n.toLocaleString()}</span>
        {p.sub && <Caption1 className={s.heroSub}>{p.sub}</Caption1>}
      </span>
      <span className={s.bars} role="img" aria-label={p.bars.map((b) => `${b.label} ${t.count(b.n)}`).join(", ")}>
        {p.bars.map((b) => (
          <span
            key={b.key}
            className={s.bar}
            style={{ height: `${Math.max(6, (b.n / max) * 100)}%` }}
            title={`${b.label} · ${t.count(b.n)}`}
          />
        ))}
      </span>
    </Tag>
  );
}

export function StatTile(p: {
  label: string;
  value?: number;
  text?: string;
  sub?: string;
  /** 숫자 색 (테마 토큰이라 다크 모드에서도 맞는다) */
  color: string;
  index: number;
  onClick?: () => void;
}) {
  const s = useStyles();
  const m = useMotion();
  const n = useCountUp(p.value ?? 0);
  const Tag = p.onClick ? "button" : "div";
  return (
    <Tag
      className={mergeClasses(s.tile, p.onClick && s.clickable, m.enter)}
      style={stagger(p.index, 50)}
      onClick={p.onClick}
    >
      <Caption1 className={s.label}>
        {p.label}
        {p.onClick && <ChevronRightRegular className={s.chevron} aria-hidden />}
      </Caption1>
      {p.text !== undefined ? (
        <span className={s.text} style={{ color: p.color }} title={p.text}>
          {p.text}
        </span>
      ) : (
        <span className={s.num} style={{ color: p.color }}>
          {n.toLocaleString()}
        </span>
      )}
      {p.sub && <Caption1 className={s.sub}>{p.sub}</Caption1>}
    </Tag>
  );
}

/** 오늘을 포함한 달력 n일의 일별 막대 (dateOf: 항목의 날짜) */
export function dailyBars<T>(lang: Lang, items: T[], dateOf: (x: T) => number, days: number): Bar[] {
  const fmt = new Intl.DateTimeFormat(LOCALE[lang], { month: "short", day: "numeric" });
  return Array.from({ length: days }, (_, i) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1 - i));
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const n = items.filter((x) => {
      const at = dateOf(x);
      return at >= start.getTime() && at < end.getTime();
    }).length;
    return { key: start.getTime(), label: fmt.format(start), n };
  });
}
