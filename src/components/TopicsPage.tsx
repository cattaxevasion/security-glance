import {
  Button,
  Caption1,
  Menu,
  MenuItemRadio,
  MenuList,
  MenuPopover,
  MenuTrigger,
  SearchBox,
  Subtitle1,
  Text,
  Tooltip,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import {
  ArrowClockwiseRegular,
  ArrowResetRegular,
  ArrowSortRegular,
  CalendarLtrRegular,
  ChevronDownRegular,
  ChevronRightRegular,
  ChevronUpRegular,
  DocumentSearchRegular,
  LinkRegular,
} from "@fluentui/react-icons";
import { useEffect, useMemo, useState } from "react";
import { ATTACK_TYPES, NATURES, SECTORS } from "../../shared/taxonomy";
import type { Topic, VulnData } from "../../shared/types";
import { REGION_LABELS, STRINGS, tagLabel, type Lang } from "../i18n";
import type { View } from "./AppNav";
import { FilterPill } from "./FilterPill";
import { dayKey, dayLabel, shortDate, timeOfDay } from "./format";
import { useStoredFlag } from "./hooks";
import { NatureMark, NatureTile, SourceAvatars } from "./marks";
import { stagger, useCountUp, useMotion } from "./motion";
import { PageTitle, usePageStyles } from "./page";
import { summaryOf, titleOf } from "./text";

export interface NewsFilters {
  attack: string[];
  sector: string[];
  nature: string[];
  days: number; // 0 = 전체
}

export const DEFAULT_FILTERS: NewsFilters = { attack: [], sector: [], nature: [], days: 7 };
export type SortMode = "latest" | "important";

/** 이 점수 이상인 토픽에 '주목' 표시 */
export const PRIORITY_THRESHOLD = 60;

/** 중요도에 최신성을 곱한 정렬 점수 (사흘마다 절반) */
export function rankScore(t: Topic, now = Date.now()): number {
  const ageHours = Math.max(0, (now - Date.parse(t.lastUpdated)) / 3600_000);
  return t.importance * Math.pow(0.5, ageHours / 72);
}
const PERIODS = [1, 3, 7, 30, 0];
const PAGE = 50;

const useStyles = makeStyles({
  overviewToggle: {
    display: "flex",
    width: "100%",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "20px",
    padding: "10px 0",
    border: "none",
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    background: "none",
    cursor: "pointer",
    color: tokens.colorNeutralForeground2,
    font: "inherit",
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    textAlign: "left",
  },
  kpis: {
    display: "grid",
    // 읽기 창이 열려 본문이 좁아져도 찌그러지지 않게, 남은 폭에 맞춰 열 수를 정한다
    gridTemplateColumns: "repeat(auto-fit, minmax(156px, 1fr))",
    gap: "8px",
    paddingBottom: "8px",
    "@media (min-width: 641px)": { gap: "12px" },
  },
  kpi: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "4px",
    padding: "12px 16px",
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    font: "inherit",
    textAlign: "left",
    cursor: "pointer",
    transitionProperty: "background-color, border-color",
    transitionDuration: tokens.durationFaster,
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      borderTopColor: tokens.colorNeutralStroke1Hover,
      borderRightColor: tokens.colorNeutralStroke1Hover,
      borderBottomColor: tokens.colorNeutralStroke1Hover,
      borderLeftColor: tokens.colorNeutralStroke1Hover,
    },
    ":focus-visible": { outline: `2px solid ${tokens.colorStrokeFocus2}`, outlineOffset: "1px" },
  },
  kpiLabel: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    color: tokens.colorNeutralForeground2,
    width: "100%",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  kpiChevron: { marginLeft: "auto", color: tokens.colorNeutralForeground3 },
  kpiNumber: {
    fontSize: tokens.fontSizeHero700,
    lineHeight: tokens.lineHeightHero700,
    fontWeight: tokens.fontWeightSemibold,
    fontVariantNumeric: "tabular-nums",
  },

  // ── 기사 목록 (읽기용) ──
  list: { margin: 0, padding: 0, listStyle: "none" },
  dayHeader: {
    position: "sticky",
    top: 0,
    zIndex: 1,
    display: "flex",
    alignItems: "baseline",
    gap: "8px",
    margin: 0,
    padding: "12px 0 8px",
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  dayCount: { fontWeight: tokens.fontWeightRegular, color: tokens.colorNeutralForeground3 },
  row: {
    position: "relative",
    display: "grid",
    gap: "0 14px",
    padding: "14px 12px",
    margin: "0 -12px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
    borderRadius: tokens.borderRadiusMedium,
    cursor: "pointer",
    transitionProperty: "background-color",
    transitionDuration: tokens.durationFaster,
    gridTemplateColumns: "32px 1fr",
    "@media (min-width: 641px)": { gridTemplateColumns: "40px 1fr 20px", padding: "16px 12px" },
    ":hover": { backgroundColor: tokens.colorSubtleBackgroundHover },
    ":focus-visible": { outline: `2px solid ${tokens.colorStrokeFocus2}`, outlineOffset: "-2px" },
  },
  selected: {
    backgroundColor: tokens.colorBrandBackground2,
    ":hover": { backgroundColor: tokens.colorBrandBackground2Hover },
    "::before": {
      content: '""',
      position: "absolute",
      left: 0,
      top: "12px",
      bottom: "12px",
      width: "3px",
      borderRadius: "2px",
      backgroundColor: tokens.colorBrandStroke1,
    },
  },
  body: { minWidth: 0 },
  title: {
    display: "-webkit-box",
    WebkitLineClamp: "2",
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    fontSize: tokens.fontSizeBase400,
    lineHeight: "24px",
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    overflowWrap: "anywhere",
  },
  summary: {
    display: "-webkit-box",
    WebkitLineClamp: "2",
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    marginTop: "4px",
    fontSize: tokens.fontSizeBase300,
    lineHeight: "22px",
    color: tokens.colorNeutralForeground2,
    overflowWrap: "anywhere",
  },
  meta: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "4px 12px",
    marginTop: "8px",
    fontSize: tokens.fontSizeBase200,
    lineHeight: "16px",
    color: tokens.colorNeutralForeground3,
  },
  metaNature: { color: tokens.colorNeutralForeground2 },
  metaIcon: { display: "inline-flex", alignItems: "center", gap: "4px" },
  // 행에 마우스를 올리면 오른쪽에서 살짝 밀려 들어오는 화살표 (누를 수 있다는 신호)
  chevron: {
    display: "none",
    alignSelf: "center",
    color: tokens.colorNeutralForeground3,
    opacity: 0,
    transform: "translateX(-4px)",
    transitionProperty: "opacity, transform",
    transitionDuration: tokens.durationNormal,
    transitionTimingFunction: tokens.curveDecelerateMid,
    "@media (min-width: 641px)": { display: "block" },
  },
  chevronOn: { opacity: 1, transform: "none" },
  priority: {
    display: "inline-flex",
    alignItems: "center",
    height: "18px",
    padding: "0 6px",
    borderRadius: tokens.borderRadiusSmall,
    backgroundColor: tokens.colorPaletteRedBackground1,
    color: tokens.colorPaletteRedForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
});

interface Props {
  lang: Lang;
  title: string;
  showRegion: boolean;
  items: Topic[];
  vulns: VulnData | null;
  filters: NewsFilters;
  setFilters: (f: NewsFilters) => void;
  sort: SortMode;
  setSort: (s: SortMode) => void;
  query: string;
  setQuery: (q: string) => void;
  narrow: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOrder: (ids: string[]) => void;
  onReload: () => void;
  onCopied: () => void;
  onGo: (view: View) => void;
}

function KpiNumber({ value, className }: { value: number; className: string }) {
  const n = useCountUp(value);
  return <span className={className}>{n.toLocaleString()}</span>;
}

export function matchesQuery(n: Topic, q: string): boolean {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  return [
    n.titleKo,
    n.titleJa,
    ...n.sources,
    ...n.summaryKo,
    ...n.summaryJa,
    ...n.entities.cves,
    ...n.entities.actors,
    ...n.entities.orgs,
    ...n.techniques.map((x) => x.id),
  ]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

export function TopicsPage(p: Props) {
  const { lang, items, filters, setFilters, query, narrow, selectedId } = p;
  const s = useStyles();
  const ps = usePageStyles();
  const m = useMotion();
  const t = STRINGS[lang];
  const [hoverRow, setHoverRow] = useState<string | null>(null);
  const [overviewOpen, setOverviewOpen] = useStoredFlag("sg-overview", true);
  const [shown, setShown] = useState(PAGE);
  const [copied, setCopied] = useState(false);

  const set = (patch: Partial<NewsFilters>) => {
    setShown(PAGE);
    setFilters({ ...filters, ...patch });
  };

  // 검색어와 기간까지 적용한 집합. 필터 메뉴의 개수는 여기서 센다.
  const base = useMemo(() => {
    const since = filters.days ? Date.now() - filters.days * 86400_000 : 0;
    return items.filter((n) => Date.parse(n.lastUpdated) >= since && matchesQuery(n, query));
  }, [items, filters.days, query]);

  const filtered = useMemo(() => {
    const out = base.filter(
      (n) =>
        filters.attack.every((x) => (n.attackTypes as string[]).includes(x)) &&
        (filters.sector.length === 0 || filters.sector.some((x) => (n.sectors as string[]).includes(x))) &&
        (filters.nature.length === 0 || filters.nature.includes(n.nature)),
    );
    if (p.sort === "important") {
      const now = Date.now();
      out.sort((a, b) => rankScore(b, now) - rankScore(a, now));
    }
    return out;
  }, [base, filters.attack, filters.sector, filters.nature, p.sort]);

  const visible = useMemo(() => filtered.slice(0, shown), [filtered, shown]);
  useEffect(() => p.onOrder(visible.map((n) => n.id)), [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const countBy = (pick: (n: Topic) => string[]) => {
    const m = new Map<string, number>();
    for (const n of base) for (const v of pick(n)) m.set(v, (m.get(v) ?? 0) + 1);
    return m;
  };
  const attackCounts = useMemo(() => countBy((n) => n.attackTypes), [base]); // eslint-disable-line react-hooks/exhaustive-deps
  const sectorCounts = useMemo(() => countBy((n) => n.sectors), [base]); // eslint-disable-line react-hooks/exhaustive-deps
  const natureCounts = useMemo(() => countBy((n) => [n.nature]), [base]); // eslint-disable-line react-hooks/exhaustive-deps

  const kpi = useMemo(() => {
    const day = (d: number) => Date.now() - d * 86400_000;
    return {
      today: items.filter((n) => Date.parse(n.lastUpdated) >= day(1)).length,
      ransom: items.filter((n) => Date.parse(n.lastUpdated) >= day(7) && n.attackTypes.includes("랜섬웨어")).length,
      kev: (p.vulns?.kev ?? []).filter((k) => Date.parse(k.dateAdded) >= day(7)).length,
      critical: (p.vulns?.cves ?? []).filter((c) => (c.cvss ?? 0) >= 9).length,
    };
  }, [items, p.vulns]);

  const groups = useMemo(() => {
    // 중요도순은 날짜로 묶지 않고 한 목록으로 보여준다
    if (p.sort === "important") return [{ key: "important", label: t.sortImportant, items: visible }];
    const out: { key: string; label: string; items: Topic[] }[] = [];
    for (const n of visible) {
      const key = dayKey(n.lastUpdated);
      const last = out[out.length - 1];
      if (last?.key === key) last.items.push(n);
      else out.push({ key, label: dayLabel(lang, n.lastUpdated, t), items: [n] });
    }
    return out;
  }, [visible, lang, t, p.sort]);

  const anyFilter = filters.attack.length + filters.sector.length + filters.nature.length > 0;
  const title = (n: Topic) => titleOf(lang, n);
  const summary = (n: Topic) => summaryOf(lang, n)[0] ?? "";
  const sourcesText = (n: Topic) =>
    n.sources.length <= 2 ? n.sources.join(", ") : `${n.sources.slice(0, 2).join(", ")} +${n.sources.length - 2}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      p.onCopied();
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // 클립보드 권한이 없으면 조용히 넘어간다
    }
  };

  const kpis = [
    {
      label: t.kpiToday,
      sub: t.kpiTodaySub,
      value: kpi.today,
      go: () => set({ days: 1, attack: [], sector: [], nature: [] }),
    },
    {
      label: t.kpiRansom,
      sub: t.kpiRansomSub,
      value: kpi.ransom,
      go: () => set({ days: 7, attack: ["랜섬웨어"], sector: [], nature: [] }),
    },
    { label: t.kpiKev, sub: t.kpiKevSub, value: kpi.kev, go: () => p.onGo("kev") },
    { label: t.kpiCritical, sub: t.kpiCriticalSub, value: kpi.critical, go: () => p.onGo("cve") },
  ];

  return (
    <div className={mergeClasses(ps.page, ps.reading)}>
      <PageTitle>{p.title}</PageTitle>

      <button className={s.overviewToggle} onClick={() => setOverviewOpen(!overviewOpen)} aria-expanded={overviewOpen}>
        {t.overview}
        {overviewOpen ? <ChevronUpRegular /> : <ChevronDownRegular />}
      </button>
      {overviewOpen && (
        <div className={s.kpis}>
          {kpis.map((k, i) => (
            <button key={k.label} className={mergeClasses(s.kpi, m.enter)} style={stagger(i, 50)} onClick={k.go}>
              <Caption1 className={s.kpiLabel}>
                {k.label}
                <ChevronRightRegular className={s.kpiChevron} aria-hidden />
              </Caption1>
              <KpiNumber value={k.value} className={s.kpiNumber} />
              <Caption1 className={ps.muted}>{k.sub}</Caption1>
            </button>
          ))}
        </div>
      )}

      <div className={ps.command}>
        <div className={ps.commandGroup}>
          <Menu
            checkedValues={{ days: [String(filters.days)] }}
            onCheckedValueChange={(_, d) => set({ days: Number(d.checkedItems[0]) })}
          >
            <MenuTrigger disableButtonEnhancement>
              <Button appearance="subtle" icon={<CalendarLtrRegular />}>
                {t.periods[filters.days]}
                <ChevronDownRegular style={{ marginLeft: 4 }} />
              </Button>
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                {PERIODS.map((d) => (
                  <MenuItemRadio key={d} name="days" value={String(d)}>
                    {t.periods[d]}
                  </MenuItemRadio>
                ))}
              </MenuList>
            </MenuPopover>
          </Menu>
          <Menu
            checkedValues={{ sort: [p.sort] }}
            onCheckedValueChange={(_, d) => p.setSort(d.checkedItems[0] as SortMode)}
          >
            <MenuTrigger disableButtonEnhancement>
              <Button appearance="subtle" icon={<ArrowSortRegular />}>
                {p.sort === "important" ? t.sortImportant : t.sortLatest}
                <ChevronDownRegular style={{ marginLeft: 4 }} />
              </Button>
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuItemRadio name="sort" value="latest">
                  {t.sortLatest}
                </MenuItemRadio>
                <MenuItemRadio name="sort" value="important">
                  {t.sortImportant}
                </MenuItemRadio>
              </MenuList>
            </MenuPopover>
          </Menu>
          <Text className={ps.count}>{t.count(filtered.length)}</Text>
        </div>
        <div className={ps.commandGroup}>
          <Tooltip content={copied ? t.copied : t.copyLink} relationship="label">
            <Button appearance="subtle" icon={<LinkRegular />} onClick={copyLink} />
          </Tooltip>
          <Tooltip content={t.refresh} relationship="label">
            <Button appearance="subtle" icon={<ArrowClockwiseRegular />} onClick={p.onReload} />
          </Tooltip>
        </div>
        {narrow && (
          <SearchBox
            className={ps.pageSearch}
            placeholder={t.search}
            value={query}
            onChange={(_, d) => p.setQuery(d.value)}
          />
        )}
      </div>

      <div className={ps.filters}>
        <FilterPill
          name="attack"
          label={t.filterAttack}
          anyLabel={t.any}
          clearLabel={t.resetAll}
          selected={filters.attack}
          onChange={(v) => set({ attack: v })}
          options={ATTACK_TYPES.map((v) => ({ value: v, label: tagLabel(lang, v), count: attackCounts.get(v) ?? 0 }))}
        />
        <FilterPill
          name="sector"
          label={t.filterSector}
          anyLabel={t.any}
          clearLabel={t.resetAll}
          selected={filters.sector}
          onChange={(v) => set({ sector: v })}
          options={SECTORS.map((v) => ({ value: v, label: tagLabel(lang, v), count: sectorCounts.get(v) ?? 0 }))}
        />
        <FilterPill
          name="nature"
          label={t.filterNature}
          anyLabel={t.any}
          clearLabel={t.resetAll}
          selected={filters.nature}
          onChange={(v) => set({ nature: v })}
          options={NATURES.filter((v) => v !== "업계 동향").map((v) => ({
            value: v,
            label: tagLabel(lang, v),
            count: natureCounts.get(v) ?? 0,
          }))}
        />
        {anyFilter && (
          <Button
            appearance="subtle"
            size="small"
            icon={<ArrowResetRegular />}
            onClick={() => set({ attack: [], sector: [], nature: [] })}
          >
            {t.resetAll}
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className={ps.empty}>
          <Subtitle1>{items.length ? t.empty : t.noData}</Subtitle1>
          {items.length > 0 && <Text>{t.emptyHint}</Text>}
        </div>
      ) : (
        <div className={ps.listSurface}>
          {groups.map((g, gi) => (
            <section key={`${g.key}-${p.sort}`} aria-label={g.label}>
              <h2 className={s.dayHeader}>
                {g.label}
                <span className={s.dayCount}>{t.count(g.items.length)}</span>
              </h2>
              <ul className={s.list}>
                {g.items.map((n, i) => (
                  <li
                    key={n.id}
                    className={mergeClasses(s.row, n.id === selectedId && s.selected, gi < 3 && m.enter)}
                    style={gi < 3 ? stagger(i + gi * 4) : undefined}
                    onMouseEnter={() => setHoverRow(n.id)}
                    onMouseLeave={() => setHoverRow(null)}
                    role="button"
                    tabIndex={0}
                    aria-current={n.id === selectedId ? "true" : undefined}
                    onClick={() => p.onSelect(n.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        p.onSelect(n.id);
                      }
                    }}
                  >
                    <NatureTile nature={n.nature} size={narrow ? 32 : 40} />
                    <div className={s.body}>
                      <div className={s.title}>{title(n)}</div>
                      {summary(n) && <div className={s.summary}>{summary(n)}</div>}
                      <div className={s.meta}>
                        {n.importance >= PRIORITY_THRESHOLD && <span className={s.priority}>{t.priority}</span>}
                        <time dateTime={n.lastUpdated}>
                          {p.sort === "important" ? shortDate(lang, n.lastUpdated) : timeOfDay(lang, n.lastUpdated)}
                        </time>
                        <NatureMark nature={n.nature} lang={lang} className={s.metaNature} />
                        {p.showRegion && <span>{n.regions.map((r) => REGION_LABELS[lang][r]).join(" · ")}</span>}
                        {n.sources.length > 1 ? (
                          <span className={s.metaIcon}>
                            <SourceAvatars sources={n.sources} />
                            {t.sourcesCount(n.sources.length)} · {sourcesText(n)}
                          </span>
                        ) : (
                          <span>{n.sources[0]}</span>
                        )}
                        {n.hasVendor && (
                          <span className={s.metaIcon}>
                            <DocumentSearchRegular aria-hidden />
                            {t.hasAnalysis}
                          </span>
                        )}
                        {n.attackTypes.length > 0 && (
                          <span>{n.attackTypes.map((a) => tagLabel(lang, a)).join(", ")}</span>
                        )}
                      </div>
                    </div>
                    <ChevronRightRegular
                      className={mergeClasses(s.chevron, (hoverRow === n.id || n.id === selectedId) && s.chevronOn)}
                      aria-hidden
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {filtered.length > shown && (
        <div className={ps.more}>
          <Button onClick={() => setShown(shown + PAGE)}>{t.more(filtered.length - shown)}</Button>
        </div>
      )}

      <Caption1 className={ps.footer}>{t.footer}</Caption1>
    </div>
  );
}
