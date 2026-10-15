// 상단 앱 바: Microsoft 365 / Defender 포털과 같은 48px 브랜드 바
import {
  Body1,
  Button,
  Caption1,
  Divider,
  Hamburger,
  Menu,
  MenuItemRadio,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  SearchBox,
  Tooltip,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import {
  ArrowSyncRegular,
  CheckmarkCircleFilled,
  ErrorCircleFilled,
  LocalLanguageRegular,
  ShieldRegular,
} from "@fluentui/react-icons";
import type { Meta } from "../../shared/types";
import { LANG_NAMES, REGION_LABELS, STRINGS, type Lang } from "../i18n";
import { fullDateTime, relativeTime } from "./format";
import { sourceLabel } from "./text";

const useStyles = makeStyles({
  bar: {
    height: "48px",
    flexShrink: 0,
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    alignItems: "center",
    gap: "12px",
    paddingLeft: "4px",
    paddingRight: "8px",
    backgroundColor: tokens.colorBrandBackgroundSelected,
    color: tokens.colorNeutralForegroundOnBrand,
    boxShadow: tokens.shadow4,
    zIndex: 2,
  },
  barDark: {
    backgroundColor: tokens.colorNeutralBackground4,
    color: tokens.colorNeutralForeground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  left: { display: "flex", alignItems: "center", gap: "4px", minWidth: 0 },
  onBrand: {
    color: "inherit",
    ":hover": { color: "inherit", backgroundColor: "rgba(255,255,255,0.12)" },
    ":hover:active": { color: "inherit", backgroundColor: "rgba(255,255,255,0.2)" },
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    whiteSpace: "nowrap",
    paddingLeft: "4px",
    // 사이트 이름을 누르면 첫 화면(오늘의 브리핑)으로
    color: "inherit",
    textDecorationLine: "none",
    borderRadius: tokens.borderRadiusMedium,
    paddingRight: "6px",
    ":hover": { backgroundColor: "rgba(255,255,255,0.12)" },
    ":focus-visible": { outline: "2px solid #fff", outlineOffset: "2px" },
  },
  brandIcon: { fontSize: "20px" },
  center: { display: "flex", justifyContent: "center", minWidth: 0 },
  search: { width: "100%", maxWidth: "468px" },
  right: { display: "flex", alignItems: "center", gap: "2px" },
  status: { display: "flex", flexDirection: "column", gap: "8px", minWidth: "260px" },
  statusRow: { display: "flex", alignItems: "center", gap: "8px" },
  ok: { color: tokens.colorPaletteGreenForeground1, flexShrink: 0 },
  bad: { color: tokens.colorPaletteRedForeground1, flexShrink: 0 },
  muted: { color: tokens.colorNeutralForeground3 },
  dot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: tokens.colorPaletteRedBackground3,
    border: `1.5px solid ${tokens.colorNeutralForegroundOnBrand}`,
    marginLeft: "-6px",
    marginTop: "-10px",
  },
});

interface Props {
  lang: Lang;
  setLang: (l: Lang) => void;
  dark: boolean;
  narrow: boolean;
  navOpen: boolean;
  toggleNav: () => void;
  query: string;
  setQuery: (q: string) => void;
  searchPlaceholder: string;
  meta: Meta | null;
  /** 사이트 이름을 눌렀을 때: 오늘의 브리핑으로 */
  onHome: () => void;
}

export function AppHeader({
  lang,
  setLang,
  dark,
  narrow,
  navOpen,
  toggleNav,
  query,
  setQuery,
  searchPlaceholder,
  meta,
  onHome,
}: Props) {
  const s = useStyles();
  const t = STRINGS[lang];
  const failed = meta?.sources.filter((x) => !x.ok) ?? [];

  return (
    <header className={mergeClasses(s.bar, dark && s.barDark)}>
      <div className={s.left}>
        <Tooltip content={navOpen ? t.collapseNav : t.expandNav} relationship="label">
          <Hamburger className={s.onBrand} onClick={toggleNav} aria-expanded={navOpen} />
        </Tooltip>
        <a
          className={s.brand}
          href={`${import.meta.env.BASE_URL.replace(/\/?$/, "/")}?lang=${lang}`}
          onClick={(e) => {
            // 새 탭으로 열기(가운데·Ctrl 클릭)는 그대로 두고, 그냥 클릭은 페이지를 다시 읽지 않고 이동
            if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            onHome();
          }}
        >
          <ShieldRegular className={s.brandIcon} aria-hidden />
          {t.appName}
        </a>
      </div>

      <div className={s.center}>
        {!narrow && (
          <Tooltip content={t.shortcuts} relationship="description" positioning="below">
            <SearchBox
              className={s.search}
              size="medium"
              appearance="filled-lighter"
              placeholder={`${searchPlaceholder}  ( / )`}
              value={query}
              onChange={(_, d) => setQuery(d.value)}
            />
          </Tooltip>
        )}
      </div>

      <div className={s.right}>
        <Menu checkedValues={{ lang: [lang] }} onCheckedValueChange={(_, d) => setLang(d.checkedItems[0] as Lang)}>
          <MenuTrigger disableButtonEnhancement>
            <Tooltip content={t.language} relationship="label">
              <Button appearance="transparent" className={s.onBrand} icon={<LocalLanguageRegular />}>
                {narrow ? null : LANG_NAMES[lang]}
              </Button>
            </Tooltip>
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              <MenuItemRadio name="lang" value="ko">
                {LANG_NAMES.ko}
              </MenuItemRadio>
              <MenuItemRadio name="lang" value="ja">
                {LANG_NAMES.ja}
              </MenuItemRadio>
            </MenuList>
          </MenuPopover>
        </Menu>

        {meta?.updatedAt && (
          <Popover withArrow positioning="below-end">
            <PopoverTrigger disableButtonEnhancement>
              <Button
                appearance="transparent"
                className={s.onBrand}
                icon={<ArrowSyncRegular />}
                aria-label={t.navStatus}
              >
                {narrow ? null : t.updated(relativeTime(lang, meta.updatedAt))}
                {failed.length > 0 && <span className={s.dot} aria-hidden />}
              </Button>
            </PopoverTrigger>
            <PopoverSurface aria-label={t.navStatus}>
              <div className={s.status}>
                <Body1>
                  <b>{t.lastCollected}</b> {fullDateTime(lang, meta.updatedAt)}
                </Body1>
                <Divider />
                {meta.sources.map((src) => (
                  <div key={src.id} className={s.statusRow}>
                    {src.ok ? <CheckmarkCircleFilled className={s.ok} /> : <ErrorCircleFilled className={s.bad} />}
                    <Caption1>
                      <span className={s.muted}>{REGION_LABELS[lang][src.region]}</span> {sourceLabel(lang, src.name)}
                      {!src.ok && <span className={s.muted}> · {t.sourceFailed}</span>}
                    </Caption1>
                  </div>
                ))}
              </div>
            </PopoverSurface>
          </Popover>
        )}
      </div>
    </header>
  );
}
