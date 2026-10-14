// 목록과 상세 패널에서 쓰는 작은 시각 표지들
import { Caption1, Tooltip, makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import {
  BugRegular,
  DocumentSearchRegular,
  GavelRegular,
  ScalesRegular,
  ShieldErrorRegular,
  type FluentIcon,
} from "@fluentui/react-icons";
import type { Nature, Region } from "../../shared/taxonomy";
import { tagLabel, type Lang } from "../i18n";
import { pct } from "./format";

export const NATURE_COLOR: Record<Nature, string> = {
  사건: tokens.colorPaletteRedBackground3,
  "취약점 공지": tokens.colorPaletteDarkOrangeBackground3,
  "체포·수사": tokens.colorPaletteBerryBackground3,
  "정책·법규": tokens.colorPaletteBlueBorderActive,
  "연구·리포트": tokens.colorPaletteTealBorderActive,
  "업계 동향": tokens.colorNeutralForeground3,
};

export const NATURE_ICON: Record<Nature, FluentIcon> = {
  사건: ShieldErrorRegular,
  "취약점 공지": BugRegular,
  "체포·수사": GavelRegular,
  "정책·법규": ScalesRegular,
  "연구·리포트": DocumentSearchRegular,
  "업계 동향": DocumentSearchRegular,
};

const useStyles = makeStyles({
  nature: { display: "inline-flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap" },
  square: { width: "8px", height: "8px", borderRadius: "2px", flexShrink: 0 },
  monogram: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "20px",
    height: "20px",
    borderRadius: tokens.borderRadiusSmall,
    border: `1.5px solid currentColor`,
    fontSize: "9px",
    fontWeight: tokens.fontWeightBold,
    letterSpacing: "0.02em",
    lineHeight: 1,
    boxSizing: "border-box",
  },
  epss: { display: "inline-flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap" },
  bars: { display: "inline-flex", gap: "2px" },
  bar: { width: "6px", height: "10px", borderRadius: "1px", backgroundColor: tokens.colorNeutralStroke2 },
});

/** 성격: 색 사각형 + 라벨 (Defender의 심각도 표시처럼 조용하게) */
export function NatureMark({ nature, lang, className }: { nature: Nature; lang: Lang; className?: string }) {
  const s = useStyles();
  return (
    <span className={mergeClasses(s.nature, className)}>
      <span className={s.square} style={{ backgroundColor: NATURE_COLOR[nature] }} aria-hidden />
      {tagLabel(lang, nature)}
    </span>
  );
}

/** 탐색 메뉴용 지역 아이콘. 국기 대신 글자 표지를 써서 아이콘 크기·선 두께를 맞춘다. */
export function RegionMonogram({ region }: { region: Exclude<Region, "INTL"> }) {
  const s = useStyles();
  return (
    <span className={s.monogram} aria-hidden>
      {region}
    </span>
  );
}

/** EPSS: 막대 3칸(낮음·중간·높음) + 퍼센트 */
export function EpssMark({
  epss,
  percentile,
  tip,
}: {
  epss: number | null;
  percentile: number | null;
  tip: (p: string, top: string) => string;
}) {
  const s = useStyles();
  if (epss == null) return <Caption1>–</Caption1>;
  const level = epss >= 0.1 ? 3 : epss >= 0.01 ? 2 : 1;
  const color =
    level === 3
      ? tokens.colorPaletteRedBackground3
      : level === 2
        ? tokens.colorPaletteDarkOrangeBackground3
        : tokens.colorNeutralForeground3;
  return (
    <Tooltip relationship="description" content={tip(pct(epss, 2), pct(1 - (percentile ?? 0), 1))}>
      <span className={s.epss}>
        <span className={s.bars} aria-hidden>
          {[1, 2, 3].map((i) => (
            <span key={i} className={s.bar} style={i <= level ? { backgroundColor: color } : undefined} />
          ))}
        </span>
        {pct(epss)}
      </span>
    </Tooltip>
  );
}
