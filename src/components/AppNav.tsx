// 왼쪽 탐색: Fluent 2 Nav (기본 260px, 640px 이하에서는 오버레이)
// 모양(C안): 흰 바탕, 선택 항목은 배너의 파랑→보라를 아주 옅게 깔고 왼쪽에 같은 색 막대. 아이콘은 모두 20px,
// 선택되면 속이 찬(Filled) 아이콘으로 바뀐다.
import {
  NavDivider,
  NavDrawer,
  NavDrawerBody,
  NavItem,
  NavSectionHeader,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import {
  AlertUrgentFilled,
  AlertUrgentRegular,
  BugFilled,
  BugRegular,
  bundleIcon,
  GlobeFilled,
  GlobeRegular,
  LayerFilled,
  LayerRegular,
  ShieldErrorFilled,
  ShieldErrorRegular,
  WeatherSunnyFilled,
  WeatherSunnyRegular,
} from "@fluentui/react-icons";
import { REGION_LABELS, STRINGS, type Lang } from "../i18n";
import { RegionMonogram } from "./marks";

export type View = "briefing" | "incidents" | "all" | "INTL" | "JP" | "kev" | "cve";
export const VIEWS: View[] = ["briefing", "incidents", "all", "INTL", "JP", "kev", "cve"];

// 선택되면 속이 찬 아이콘 (NavItem이 선택 상태에서 Filled 쪽을 보여준다)
const Briefing = bundleIcon(WeatherSunnyFilled, WeatherSunnyRegular);
const Incidents = bundleIcon(AlertUrgentFilled, AlertUrgentRegular);
const AllTopics = bundleIcon(LayerFilled, LayerRegular);
const Intl = bundleIcon(GlobeFilled, GlobeRegular);
const Kev = bundleIcon(ShieldErrorFilled, ShieldErrorRegular);
const Cve = bundleIcon(BugFilled, BugRegular);

/** 배너·상단 바 선과 같은 색 흐름 */
const BAR = "linear-gradient(180deg, #0f548c 0%, #4a3a9c 100%)";
const BAR_DARK = "linear-gradient(180deg, #3a86cf 0%, #7b68d6 100%)";
const SELECTED = "linear-gradient(90deg, rgba(15,84,140,0.13) 0%, rgba(74,58,156,0.05) 100%)";
const SELECTED_DARK = "linear-gradient(90deg, rgba(58,134,207,0.26) 0%, rgba(123,104,214,0.10) 100%)";

const useStyles = makeStyles({
  drawer: {
    height: "100%",
    backgroundColor: tokens.colorNeutralBackground1,
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  body: { paddingTop: "10px", paddingLeft: 0, paddingRight: "10px" },
  navItem: {
    backgroundColor: "transparent",
    borderRadius: `0 ${tokens.borderRadiusXLarge} ${tokens.borderRadiusXLarge} 0`,
    paddingLeft: "18px",
    ":hover": { backgroundColor: tokens.colorSubtleBackgroundHover },
    // 아이콘은 모두 20px로 (기본은 칸만 20px이고 그림은 14px이라 작고 들쭉날쭉해 보였다)
    "& .fui-NavItem__icon": { width: "20px", height: "20px", fontSize: "20px" },
    '&[aria-current="page"]': {
      backgroundImage: SELECTED,
      color: "#0c3b5e",
      fontWeight: tokens.fontWeightSemibold,
    },
    '&[aria-current="page"] .fui-NavItem__icon': { color: "#2b5fb8" },
    '&[aria-current="page"]::after': { backgroundImage: BAR, width: "3px" },
  },
  navItemDark: {
    '&[aria-current="page"]': { backgroundImage: SELECTED_DARK, color: tokens.colorNeutralForeground1 },
    '&[aria-current="page"] .fui-NavItem__icon': { color: "#8cbcf0" },
    '&[aria-current="page"]::after': { backgroundImage: BAR_DARK },
  },
  section: {
    paddingLeft: "18px",
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    letterSpacing: "0.04em",
  },
  item: { display: "flex", alignItems: "center", width: "100%", gap: "8px" },
  // 지난 방문 이후 새 소식 수
  fresh: {
    marginLeft: "auto",
    padding: "0 6px",
    borderRadius: tokens.borderRadiusCircular,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground2,
    fontSize: tokens.fontSizeBase100,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: "16px",
  },
  freshThenCount: { marginLeft: "6px" },
  count: {
    marginLeft: "auto",
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    fontVariantNumeric: "tabular-nums",
  },
});

interface Props {
  lang: Lang;
  view: View;
  setView: (v: View) => void;
  open: boolean;
  overlay: boolean;
  onClose: () => void;
  counts: Record<View, number | null>;
  /** 지난 방문 이후 새 소식 수 */
  fresh: Partial<Record<View, number>>;
  dark: boolean;
}

export function AppNav({ lang, view, setView, open, overlay, onClose, counts, fresh, dark }: Props) {
  const s = useStyles();
  const item = mergeClasses(s.navItem, dark && s.navItemDark);
  const t = STRINGS[lang];
  const regions = REGION_LABELS[lang];

  const label = (text: string, v: View) => (
    <span className={s.item}>
      {text}
      {!!fresh[v] && (
        <span className={s.fresh} title={t.newSince(fresh[v]!)}>
          +{fresh[v]}
        </span>
      )}
      {counts[v] != null && (
        <span className={fresh[v] ? mergeClasses(s.count, s.freshThenCount) : s.count}>
          {counts[v]!.toLocaleString()}
        </span>
      )}
    </span>
  );

  return (
    <NavDrawer
      className={s.drawer}
      open={open}
      type={overlay ? "overlay" : "inline"}
      onOpenChange={(_, d) => !d.open && onClose()}
      selectedValue={view}
      onNavItemSelect={(_, d) => {
        setView(d.value as View);
        if (overlay) onClose();
      }}
    >
      <NavDrawerBody className={s.body}>
        <NavItem className={item} value="briefing" icon={<Briefing />}>
          {t.navBriefing}
        </NavItem>
        <NavItem className={item} value="incidents" icon={<Incidents />}>
          {label(t.navIncidents, "incidents")}
        </NavItem>

        <NavDivider />
        <NavSectionHeader className={s.section}>{t.navArticles}</NavSectionHeader>
        <NavItem className={item} value="all" icon={<AllTopics />}>
          {label(t.navAll, "all")}
        </NavItem>
        <NavItem className={item} value="JP" icon={<RegionMonogram region="JP" filled={view === "JP"} />}>
          {label(regions.JP, "JP")}
        </NavItem>
        <NavItem className={item} value="INTL" icon={<Intl />}>
          {label(regions.INTL, "INTL")}
        </NavItem>

        <NavDivider />
        <NavSectionHeader className={s.section}>{t.navVulns}</NavSectionHeader>
        <NavItem className={item} value="kev" icon={<Kev />}>
          {label(t.navKev, "kev")}
        </NavItem>
        <NavItem className={item} value="cve" icon={<Cve />}>
          {label(t.navCve, "cve")}
        </NavItem>
      </NavDrawerBody>
    </NavDrawer>
  );
}
