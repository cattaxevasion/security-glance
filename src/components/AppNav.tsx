// 왼쪽 탐색: Fluent 2 Nav (기본 260px, 640px 이하에서는 오버레이)
import {
  NavDivider,
  NavDrawer,
  NavDrawerBody,
  NavItem,
  NavSectionHeader,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { BugRegular, GlobeRegular, NewsRegular, ShieldErrorRegular } from "@fluentui/react-icons";
import { REGION_LABELS, STRINGS, type Lang } from "../i18n";
import { RegionMonogram } from "./marks";

export type View = "all" | "INTL" | "JP" | "KR" | "kev" | "cve";
export const VIEWS: View[] = ["all", "INTL", "JP", "KR", "kev", "cve"];

const useStyles = makeStyles({
  drawer: {
    height: "100%",
    borderRight: `1px solid ${tokens.colorNeutralStroke3}`,
  },
  body: { paddingTop: "8px" },
  item: { display: "flex", alignItems: "center", width: "100%", gap: "8px" },
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
}

export function AppNav({ lang, view, setView, open, overlay, onClose, counts }: Props) {
  const s = useStyles();
  const t = STRINGS[lang];
  const regions = REGION_LABELS[lang];

  const label = (text: string, v: View) => (
    <span className={s.item}>
      {text}
      {counts[v] != null && <span className={s.count}>{counts[v]!.toLocaleString()}</span>}
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
        <NavSectionHeader>{t.navArticles}</NavSectionHeader>
        <NavItem value="all" icon={<NewsRegular />}>
          {label(t.navAll, "all")}
        </NavItem>
        <NavItem value="INTL" icon={<GlobeRegular />}>
          {label(regions.INTL, "INTL")}
        </NavItem>
        <NavItem value="JP" icon={<RegionMonogram region="JP" />}>
          {label(regions.JP, "JP")}
        </NavItem>
        <NavItem value="KR" icon={<RegionMonogram region="KR" />}>
          {label(regions.KR, "KR")}
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
