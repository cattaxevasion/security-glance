// 왼쪽 탐색: Fluent 2 Nav (기본 260px, 640px 이하에서는 오버레이)
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
  AlertUrgentRegular,
  BugRegular,
  GlobeRegular,
  LayerRegular,
  ShieldErrorRegular,
  WeatherSunnyRegular,
} from "@fluentui/react-icons";
import { REGION_LABELS, STRINGS, type Lang } from "../i18n";
import { RegionMonogram } from "./marks";

export type View = "briefing" | "incidents" | "all" | "INTL" | "JP" | "kev" | "cve";
export const VIEWS: View[] = ["briefing", "incidents", "all", "INTL", "JP", "kev", "cve"];

const useStyles = makeStyles({
  drawer: {
    height: "100%",
    borderRight: `1px solid ${tokens.colorNeutralStroke3}`,
  },
  body: { paddingTop: "8px" },
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
}

export function AppNav({ lang, view, setView, open, overlay, onClose, counts, fresh }: Props) {
  const s = useStyles();
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
        <NavItem value="briefing" icon={<WeatherSunnyRegular />}>
          {t.navBriefing}
        </NavItem>
        <NavItem value="incidents" icon={<AlertUrgentRegular />}>
          {label(t.navIncidents, "incidents")}
        </NavItem>

        <NavDivider />
        <NavSectionHeader>{t.navArticles}</NavSectionHeader>
        <NavItem value="all" icon={<LayerRegular />}>
          {label(t.navAll, "all")}
        </NavItem>
        <NavItem value="JP" icon={<RegionMonogram region="JP" />}>
          {label(regions.JP, "JP")}
        </NavItem>
        <NavItem value="INTL" icon={<GlobeRegular />}>
          {label(regions.INTL, "INTL")}
        </NavItem>

        <NavDivider />
        <NavSectionHeader>{t.navVulns}</NavSectionHeader>
        <NavItem value="kev" icon={<ShieldErrorRegular />}>
          {label(t.navKev, "kev")}
        </NavItem>
        <NavItem value="cve" icon={<BugRegular />}>
          {label(t.navCve, "cve")}
        </NavItem>
      </NavDrawerBody>
    </NavDrawer>
  );
}
