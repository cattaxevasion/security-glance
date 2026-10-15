// 목록과 상세 패널에서 쓰는 작은 시각 표지들
import {
  AvatarGroup,
  AvatarGroupItem,
  Caption1,
  Tooltip,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
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
  avatars: { display: "inline-flex", alignItems: "center" },
  tile: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    borderRadius: tokens.borderRadiusLarge,
  },
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

// 성격별 아이콘 타일 색 (옅은 배경 + 진한 아이콘, 다크 모드에서는 토큰이 알아서 바뀐다)
const NATURE_TINT: Record<Nature, { bg: string; fg: string }> = {
  사건: { bg: tokens.colorPaletteRedBackground1, fg: tokens.colorPaletteRedForeground1 },
  "취약점 공지": { bg: tokens.colorPaletteDarkOrangeBackground1, fg: tokens.colorPaletteDarkOrangeForeground1 },
  "체포·수사": { bg: tokens.colorPaletteBerryBackground1, fg: tokens.colorPaletteBerryForeground1 },
  "정책·법규": { bg: tokens.colorPaletteBlueBackground2, fg: tokens.colorPaletteBlueForeground2 },
  "연구·리포트": { bg: tokens.colorPaletteTealBackground2, fg: tokens.colorPaletteTealForeground2 },
  "업계 동향": { bg: tokens.colorNeutralBackground3, fg: tokens.colorNeutralForeground3 },
};

/** 목록 앞의 40px 아이콘 타일: 성격을 색과 모양으로 한눈에 */
export function NatureTile({ nature, size = 40 }: { nature: Nature; size?: number }) {
  const s = useStyles();
  const Icon = NATURE_ICON[nature];
  const c = NATURE_TINT[nature];
  return (
    <span
      className={s.tile}
      style={{ width: size, height: size, backgroundColor: c.bg, color: c.fg, fontSize: Math.round(size * 0.5) }}
      aria-hidden
    >
      <Icon />
    </span>
  );
}

/** 여러 출처를 묶은 토픽: 출처 이니셜 아바타를 겹쳐 보여준다 (まとめ라는 신호) */
export function SourceAvatars({ sources, max = 3 }: { sources: string[]; max?: number }) {
  const s = useStyles();
  return (
    <span className={s.avatars}>
      <AvatarGroup layout="stack" size={20} aria-hidden>
        {sources.slice(0, max).map((n) => (
          <AvatarGroupItem key={n} name={n} color="colorful" />
        ))}
      </AvatarGroup>
    </span>
  );
}

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
