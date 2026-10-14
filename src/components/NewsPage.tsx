import {
  Body1,
  Button,
  Caption1,
  Card,
  Menu,
  MenuItemRadio,
  MenuList,
  MenuPopover,
  MenuTrigger,
  SearchBox,
  Subtitle1,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  Toolbar,
  ToolbarButton,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import {
  ArrowClockwiseRegular,
  ArrowResetRegular,
  CalendarLtrRegular,
  ChevronDownRegular,
  ChevronUpRegular,
  LinkRegular,
} from "@fluentui/react-icons";
import { useEffect, useMemo, useState } from "react";
import { ATTACK_TYPES, NATURES, SECTORS } from "../../shared/taxonomy";
import type { NewsItem, VulnData } from "../../shared/types";
import { REGION_LABELS, STRINGS, tagLabel, type Lang } from "../i18n";
import { FilterPill } from "./FilterPill";
import { dayKey, dayLabel, timeOfDay } from "./format";
import { useStoredFlag } from "./hooks";
import { NatureMark } from "./marks";
import { PageTitle, usePageStyles } from "./page";

export interface NewsFilters {
  attack: string[];
  sector: string[];
  nature: string[];
  days: number; // 0 = 전체
}

export const DEFAULT_FILTERS: NewsFilters = { attack: [], sector: [], nature: [], days: 7 };
const PERIODS = [1, 3, 7, 30, 0];
const PAGE = 60;

const useStyles = makeStyles({
  overviewToggle: {
    display: "flex",
    width: "100%",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "16px",
    padding: "10px 0",
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    background: "none",
    borderLeft: "none",
    borderRight: "none",
    cursor: "pointer",
    color: tokens.colorNeutralForeground1,
    font: "inherit",
    fontSize: tokens.fontSizeBase300,
    textAlign: "left",
  },
  kpis: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "8px",
    padding: "12px 0 4px",
    "@media (min-width: 641px)": { gridTemplateColumns: "repeat(auto-fill, minmax(200px, 240px))", gap: "16px", paddingTop: "16px" },
  },
  kpi: {
    padding: "10px 12px",
    gap: "2px",
    minHeight: "84px",
    "@media (min-width: 641px)": { padding: "12px 16px", minHeight: "96px" },
  },
  kpiLabel: { fontWeight: tokens.fontWeightSemibold },
  kpiValue: { display: "flex", alignItems: "baseline", gap: "8px", marginTop: "auto" },
  kpiNumber: {
    fontSize: tokens.fontSizeHero800,
    lineHeight: tokens.lineHeightHero800,
    fontWeight: tokens.fontWeightSemibold,
    fontVariantNumeric: "tabular-nums",
  },
  colTime: { width: "64px" },
  colRegion: { width: "112px" },
  colNature: { width: "148px" },
  colSource: { width: "168px" },
  titleCell: { paddingTop: "8px", paddingBottom: "8px", minWidth: 0 },
  title: { color: tokens.colorNeutralForeground1 },
  summary: { color: tokens.colorNeutralForeground3, marginTop: "2px" },
  meta: { color: tokens.colorNeutralForeground3, marginTop: "4px", display: "flex", gap: "6px", flexWrap: "wrap" },
});

interface Props {
  lang: Lang;
  title: string;
  items: NewsItem[];
  vulns: VulnData | null;
  filters: NewsFilters;
  setFilters: (f: NewsFilters) => void;
  query: string;
  setQuery: (q: string) => void;
  narrow: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOrder: (ids: string[]) => void;
  onReload: () => void;
}

export function matchesQuery(n: NewsItem, q: string): boolean {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  return [n.titleKo, n.titleJa, n.title, n.sourceName, ...n.summaryKo, ...n.summaryJa, ...n.entities.cves, ...n.entities.actors, ...n.entities.orgs]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

export function NewsPage(p: Props) {
  const { lang, items, filters, setFilters, query, narrow, selectedId } = p;
  const s = useStyles();
  const ps = usePageStyles();
  const t = STRINGS[lang];
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
    return items.filter((n) => Date.parse(n.publishedAt) >= since && matchesQuery(n, query));
  }, [items, filters.days, query]);

  const filtered = useMemo(
    () =>
      base.filter(
        (n) =>
          filters.attack.every((x) => (n.attackTypes as string[]).includes(x)) &&
          (filters.sector.length === 0 || filters.sector.some((x) => (n.sectors as string[]).includes(x))) &&
          (filters.nature.length === 0 || filters.nature.includes(n.nature)),
      ),
    [base, filters.attack, filters.sector, filters.nature],
  );

  const visible = useMemo(() => filtered.slice(0, shown), [filtered, shown]);
  useEffect(() => p.onOrder(visible.map((n) => n.id)), [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const countBy = (pick: (n: NewsItem) => string[]) => {
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
      today: items.filter((n) => Date.parse(n.publishedAt) >= day(1)).length,
      ransom: items.filter((n) => Date.parse(n.publishedAt) >= day(7) && n.attackTypes.includes("랜섬웨어")).length,
      kev: (p.vulns?.kev ?? []).filter((k) => Date.parse(k.dateAdded) >= day(7)).length,
      critical: (p.vulns?.cves ?? []).filter((c) => (c.cvss ?? 0) >= 9).length,
    };
  }, [items, p.vulns]);

  const groups = useMemo(() => {
    const out: { key: string; label: string; items: NewsItem[] }[] = [];
    for (const n of visible) {
      const key = dayKey(n.publishedAt);
      const last = out[out.length - 1];
      if (last?.key === key) last.items.push(n);
      else out.push({ key, label: dayLabel(lang, n.publishedAt, t), items: [n] });
    }
    return out;
  }, [visible, lang, t]);

  const anyFilter = filters.attack.length + filters.sector.length + filters.nature.length > 0;
  const title = (n: NewsItem) => (lang === "ja" ? n.titleJa || n.titleKo : n.titleKo);
  const summary = (n: NewsItem) => (lang === "ja" && n.summaryJa.length ? n.summaryJa : n.summaryKo)[0] ?? "";
  const regionText = (n: NewsItem) => n.regions.map((r) => REGION_LABELS[lang][r]).join(" · ");

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // 클립보드 권한이 없으면 조용히 넘어간다
    }
  };

  const kpis = [
    { label: t.kpiToday, sub: t.kpiTodaySub, value: kpi.today },
    { label: t.kpiRansom, sub: t.kpiRansomSub, value: kpi.ransom },
    { label: t.kpiKev, sub: t.kpiKevSub, value: kpi.kev },
    { label: t.kpiCritical, sub: t.kpiCriticalSub, value: kpi.critical },
  ];

  return (
    <div className={ps.page}>
      <PageTitle>{p.title}</PageTitle>

      <button className={s.overviewToggle} onClick={() => setOverviewOpen(!overviewOpen)} aria-expanded={overviewOpen}>
        {t.overview}
        {overviewOpen ? <ChevronUpRegular /> : <ChevronDownRegular />}
      </button>
      {overviewOpen && (
        <div className={s.kpis}>
          {kpis.map((k) => (
            <Card key={k.label} className={s.kpi}>
              <Body1 className={s.kpiLabel}>{k.label}</Body1>
              <div className={s.kpiValue}>
                <span className={s.kpiNumber}>{k.value.toLocaleString()}</span>
                <Caption1 className={ps.muted}>{k.sub}</Caption1>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className={ps.command}>
        <Toolbar size="small" aria-label="commands">
          <ToolbarButton icon={<LinkRegular />} onClick={copyLink}>
            {copied ? t.copied : t.copyLink}
          </ToolbarButton>
          <ToolbarButton icon={<ArrowClockwiseRegular />} onClick={p.onReload}>
            {t.refresh}
          </ToolbarButton>
        </Toolbar>
        <div className={ps.commandGroup}>
          <Menu checkedValues={{ days: [String(filters.days)] }} onCheckedValueChange={(_, d) => set({ days: Number(d.checkedItems[0]) })}>
            <MenuTrigger disableButtonEnhancement>
              <Button appearance="subtle" size="small" icon={<CalendarLtrRegular />}>
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
          <Caption1 className={ps.count}>{t.count(filtered.length)}</Caption1>
        </div>
        {narrow && (
          <SearchBox className={ps.pageSearch} placeholder={t.search} value={query} onChange={(_, d) => p.setQuery(d.value)} />
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

      <div className={ps.tableWrap}>
        {filtered.length === 0 ? (
          <div className={ps.empty}>
            <Subtitle1>{items.length ? t.empty : t.noData}</Subtitle1>
            {items.length > 0 && <Text>{t.emptyHint}</Text>}
          </div>
        ) : (
          <Table size="small" aria-label={p.title} style={{ tableLayout: "fixed", minWidth: narrow ? undefined : 760 }}>
            {!narrow && (
              <TableHeader>
                <TableRow>
                  <TableHeaderCell className={s.colTime}>{t.colTime}</TableHeaderCell>
                  <TableHeaderCell className={s.colRegion}>{t.colRegion}</TableHeaderCell>
                  <TableHeaderCell>{t.colTitle}</TableHeaderCell>
                  <TableHeaderCell className={s.colNature}>{t.colNature}</TableHeaderCell>
                  <TableHeaderCell className={s.colSource}>{t.colSource}</TableHeaderCell>
                </TableRow>
              </TableHeader>
            )}
            <TableBody>
              {groups.flatMap((g) => [
                <TableRow key={`g-${g.key}`} className={ps.groupRow} aria-hidden>
                  <TableCell colSpan={narrow ? 1 : 5} className={ps.groupCell}>
                    {g.label}
                    <span className={ps.groupCount}>{t.count(g.items.length)}</span>
                  </TableCell>
                </TableRow>,
                ...g.items.map((n) => (
                  <TableRow
                    key={n.id}
                    className={ps.row}
                    appearance={n.id === selectedId ? "brand" : "none"}
                    aria-selected={n.id === selectedId}
                    tabIndex={0}
                    onClick={() => p.onSelect(n.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        p.onSelect(n.id);
                      }
                    }}
                  >
                    {!narrow && (
                      <TableCell className={ps.nowrap}>
                        <Caption1 className={ps.muted}>{timeOfDay(lang, n.publishedAt)}</Caption1>
                      </TableCell>
                    )}
                    {!narrow && (
                      <TableCell>
                        <Caption1 className={ps.clamp1}>{regionText(n)}</Caption1>
                      </TableCell>
                    )}
                    <TableCell className={s.titleCell}>
                      <Body1 className={`${ps.clamp1} ${s.title}`}>{title(n)}</Body1>
                      <Caption1 className={`${ps.clamp1} ${s.summary}`}>{summary(n)}</Caption1>
                      {narrow && (
                        <Caption1 className={s.meta}>
                          <span>{timeOfDay(lang, n.publishedAt)}</span>·<span>{regionText(n)}</span>·
                          <NatureMark nature={n.nature} lang={lang} />·<span>{n.sourceName}</span>
                        </Caption1>
                      )}
                    </TableCell>
                    {!narrow && (
                      <TableCell>
                        <Caption1>
                          <NatureMark nature={n.nature} lang={lang} />
                        </Caption1>
                      </TableCell>
                    )}
                    {!narrow && (
                      <TableCell>
                        <Caption1 className={`${ps.clamp1} ${ps.muted}`}>{n.sourceName}</Caption1>
                      </TableCell>
                    )}
                  </TableRow>
                )),
              ])}
            </TableBody>
          </Table>
        )}
      </div>

      {filtered.length > shown && (
        <div className={ps.more}>
          <Button onClick={() => setShown(shown + PAGE)}>{t.more(filtered.length - shown)}</Button>
        </div>
      )}

      <Caption1 className={ps.footer}>{t.footer}</Caption1>
    </div>
  );
}
