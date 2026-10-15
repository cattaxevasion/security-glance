// 인시던트: 실제 침해 사고(성격 '사건') 토픽만 모아 보는 화면.
// 위쪽에 30일 일별 추이(일본/국제 누적 막대)와 핵심 수치, 아래에 피해 조직이 먼저 보이는 목록.
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
  Tab,
  TabList,
  Text,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { CalendarLtrRegular, ChevronDownRegular, ChevronRightRegular, DismissRegular } from "@fluentui/react-icons";
import { useEffect, useMemo, useState } from "react";
import { ATTACK_TYPES, SECTORS, type Region } from "../../shared/taxonomy";
import type { Topic } from "../../shared/types";
import { LOCALE, REGION_LABELS, STRINGS, tagLabel, type Lang } from "../i18n";
import { FilterPill } from "./FilterPill";
import { dayKey, shortDate, timeOfDay } from "./format";
import { stagger, useCountUp, useMotion } from "./motion";
import { PageTitle, usePageStyles } from "./page";
import { PRIORITY_THRESHOLD, matchesQuery } from "./TopicsPage";

// 두 지역 색: 데이터 시각화 검증기(CVD·밝기·대비)를 통과한 조합. 라이트/다크 각각 따로 고른 단계.
const SERIES = {
  light: { JP: "#0F6CBD", INTL: "#DA3B01" },
  dark: { JP: "#2C8BE0", INTL: "#E36F2E" },
};

const DAYS = 30;
const PERIODS = [7, 30, 90];

const useStyles = makeStyles({
  regionTabs: { marginTop: "12px", marginLeft: "-10px" },
  overview: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "16px",
    marginTop: "16px",
    "@media (min-width: 1100px)": { gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)" },
  },
  card: {
    padding: "16px 20px",
    borderRadius: tokens.borderRadiusXLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  cardHead: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: "4px 12px",
  },
  cardTitle: { fontWeight: tokens.fontWeightSemibold },
  muted: { color: tokens.colorNeutralForeground3 },
  legend: {
    display: "flex",
    gap: "16px",
    alignItems: "center",
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  swatch: {
    width: "10px",
    height: "10px",
    borderRadius: "2px",
    display: "inline-block",
    marginRight: "6px",
    verticalAlign: "-1px",
  },
  // 차트
  plot: { position: "relative", display: "grid", gridTemplateColumns: "28px 1fr", gap: "0 8px", marginTop: "16px" },
  yAxis: {
    position: "relative",
    height: "140px",
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
  },
  yTop: { position: "absolute", top: "-6px", right: 0 },
  yZero: { position: "absolute", bottom: "-6px", right: 0 },
  bars: {
    position: "relative",
    height: "140px",
    display: "flex",
    alignItems: "flex-end",
    gap: "2px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    "::before": {
      content: '""',
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      borderTop: `1px dashed ${tokens.colorNeutralStroke3}`,
    },
  },
  col: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    gap: "2px",
    padding: 0,
    border: "none",
    background: "none",
    cursor: "pointer",
    borderRadius: "4px 4px 0 0",
    transitionProperty: "opacity",
    transitionDuration: tokens.durationFast,
    ":hover": { backgroundColor: tokens.colorSubtleBackgroundHover },
    ":focus-visible": { outline: `2px solid ${tokens.colorStrokeFocus2}`, outlineOffset: "1px" },
  },
  dim: { opacity: 0.3 },
  seg: { width: "100%", minHeight: "3px" },
  segTop: { borderRadius: "4px 4px 0 0" },
  xAxis: {
    gridColumn: "2",
    display: "flex",
    justifyContent: "space-between",
    marginTop: "6px",
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
  },
  tooltip: {
    position: "absolute",
    top: "-8px",
    transform: "translate(-50%, -100%)",
    pointerEvents: "none",
    padding: "6px 10px",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow16,
    fontSize: tokens.fontSizeBase200,
    lineHeight: "18px",
    whiteSpace: "nowrap",
    zIndex: 2,
  },
  srOnly: {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
  },
  // 수치 타일
  stats: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" },
  stat: { display: "flex", flexDirection: "column", gap: "2px", padding: "12px 16px" },
  statLead: { gridColumn: "1 / -1" },
  statNum: {
    fontSize: tokens.fontSizeHero700,
    lineHeight: tokens.lineHeightHero700,
    fontWeight: tokens.fontWeightSemibold,
    fontVariantNumeric: "tabular-nums",
  },
  statLeadNum: { fontSize: tokens.fontSizeHero900, lineHeight: tokens.lineHeightHero900 },
  statText: { fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold, lineHeight: "24px" },
  // 목록
  dayChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    height: "28px",
    paddingLeft: "10px",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground2,
  },
  list: { margin: 0, padding: 0, listStyle: "none" },
  row: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "0 16px",
    padding: "16px 12px",
    margin: "0 -12px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
    borderRadius: tokens.borderRadiusMedium,
    cursor: "pointer",
    transitionProperty: "background-color",
    transitionDuration: tokens.durationFaster,
    "@media (min-width: 641px)": { gridTemplateColumns: "64px 1fr 20px" },
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
  when: {
    display: "none",
    flexDirection: "column",
    gap: "2px",
    paddingTop: "2px",
    fontSize: tokens.fontSizeBase200,
    lineHeight: "16px",
    color: tokens.colorNeutralForeground3,
    fontVariantNumeric: "tabular-nums",
    "@media (min-width: 641px)": { display: "flex" },
  },
  whenDate: { color: tokens.colorNeutralForeground2, fontWeight: tokens.fontWeightSemibold },
  live: {
    display: "inline-block",
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: tokens.colorPaletteRedBackground3,
    marginRight: "6px",
    verticalAlign: "1px",
  },
  body: { minWidth: 0 },
  orgs: {
    fontSize: tokens.fontSizeBase200,
    lineHeight: "18px",
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
    marginBottom: "2px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
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
  metaWhen: { "@media (min-width: 641px)": { display: "none" } },
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
});

const regionOf = (t: Topic): Region => (t.regions.includes("JP") ? "JP" : "INTL");

interface Props {
  lang: Lang;
  dark: boolean;
  topics: Topic[];
  query: string;
  setQuery: (q: string) => void;
  narrow: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOrder: (ids: string[]) => void;
}

export function IncidentsPage(p: Props) {
  const { lang, narrow } = p;
  const s = useStyles();
  const ps = usePageStyles();
  const m = useMotion();
  const t = STRINGS[lang];
  const colors = p.dark ? SERIES.dark : SERIES.light;

  const [region, setRegion] = useState<"all" | Region>("all");
  const [days, setDays] = useState(30);
  const [attack, setAttack] = useState<string[]>([]);
  const [sector, setSector] = useState<string[]>([]);
  const [day, setDay] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [hoverRow, setHoverRow] = useState<string | null>(null);

  const incidents = useMemo(() => p.topics.filter((x) => x.nature === "사건"), [p.topics]);
  const inRegion = useMemo(
    () => incidents.filter((x) => region === "all" || x.regions.includes(region)),
    [incidents, region],
  );

  // ── 차트 데이터: 오늘 포함 최근 30일, 지역별 개수 ──
  const series = useMemo(() => {
    const out: { key: string; date: Date; JP: number; INTL: number }[] = [];
    const today = new Date();
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      out.push({ key: dayKey(d.toISOString()), date: d, JP: 0, INTL: 0 });
    }
    const idx = new Map(out.map((x, i) => [x.key, i]));
    for (const x of inRegion) {
      const i = idx.get(dayKey(x.firstSeen));
      if (i !== undefined) out[i][regionOf(x)]++;
    }
    return out;
  }, [inRegion]);
  const yMax = Math.max(4, ...series.map((x) => x.JP + x.INTL));

  // ── 수치 ──
  const stats = useMemo(() => {
    const since = Date.now() - 7 * 86400_000;
    const week = inRegion.filter((x) => Date.parse(x.firstSeen) >= since);
    const sectorCount = new Map<string, number>();
    for (const x of week) for (const v of x.sectors) sectorCount.set(v, (sectorCount.get(v) ?? 0) + 1);
    const top = [...sectorCount.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      week: week.length,
      jp: week.filter((x) => x.regions.includes("JP")).length,
      ransom: week.filter((x) => x.attackTypes.includes("랜섬웨어")).length,
      leak: week.filter((x) => x.attackTypes.includes("정보유출")).length,
      topSector: top ? tagLabel(lang, top[0]) : t.noSector,
    };
  }, [inRegion, lang, t.noSector]);
  const weekN = useCountUp(stats.week);
  const jpN = useCountUp(stats.jp);
  const ransomN = useCountUp(stats.ransom);
  const leakN = useCountUp(stats.leak);

  // ── 목록 ──
  const list = useMemo(() => {
    const since = Date.now() - days * 86400_000;
    return inRegion
      .filter(
        (x) =>
          (day ? dayKey(x.firstSeen) === day : Date.parse(x.lastUpdated) >= since) &&
          matchesQuery(x, p.query) &&
          attack.every((a) => (x.attackTypes as string[]).includes(a)) &&
          (sector.length === 0 || sector.some((v) => (x.sectors as string[]).includes(v))),
      )
      .sort((a, b) => b.firstSeen.localeCompare(a.firstSeen));
  }, [inRegion, days, day, p.query, attack, sector]);

  const ids = useMemo(() => list.map((x) => x.id), [list]);
  useEffect(() => p.onOrder(ids), [ids]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmtDay = (d: Date) => new Intl.DateTimeFormat(LOCALE[lang], { month: "numeric", day: "numeric" }).format(d);
  const fmtDayLong = (d: Date) =>
    new Intl.DateTimeFormat(LOCALE[lang], { month: "long", day: "numeric", weekday: "short" }).format(d);
  const title = (x: Topic) => (lang === "ja" ? x.titleJa || x.titleKo : x.titleKo);
  const summary = (x: Topic) => (lang === "ja" && x.summaryJa.length ? x.summaryJa : x.summaryKo)[0] ?? "";
  const isLive = (x: Topic) => Date.now() - Date.parse(x.lastUpdated) < 86400_000;
  const selectedDay = day ? series.find((x) => x.key === day) : undefined;
  const pctOf = (n: number) => (stats.week ? `${Math.round((n / stats.week) * 100)}%` : "–");

  return (
    <div className={mergeClasses(ps.page, ps.reading)} style={{ maxWidth: 1180 }}>
      <PageTitle>{t.incidentsTitle}</PageTitle>
      <Text className={ps.desc}>{t.incidentsDesc}</Text>

      <TabList
        className={s.regionTabs}
        selectedValue={region}
        onTabSelect={(_, d) => {
          setRegion(d.value as "all" | Region);
          setDay(null);
        }}
      >
        <Tab value="all">{t.regionAll}</Tab>
        <Tab value="JP">{REGION_LABELS[lang].JP}</Tab>
        <Tab value="INTL">{REGION_LABELS[lang].INTL}</Tab>
      </TabList>

      <div className={s.overview}>
        {/* 일별 추이 */}
        <section className={mergeClasses(s.card, m.enter)} aria-label={t.chartTitle}>
          <div className={s.cardHead}>
            <Text className={s.cardTitle}>{t.chartTitle}</Text>
            <span className={s.legend}>
              {(["JP", "INTL"] as Region[])
                .filter((r) => region === "all" || region === r)
                .map((r) => (
                  <span key={r}>
                    <span className={s.swatch} style={{ backgroundColor: colors[r] }} />
                    {REGION_LABELS[lang][r]}
                  </span>
                ))}
            </span>
          </div>
          <Caption1 className={s.muted}>{t.chartHint}</Caption1>

          <div className={s.plot}>
            <div className={s.yAxis} aria-hidden>
              <span className={s.yTop}>{yMax}</span>
              <span className={s.yZero}>0</span>
            </div>
            <div className={s.bars} onMouseLeave={() => setHover(null)}>
              {series.map((x, i) => {
                const total = x.JP + x.INTL;
                const jpH = (x.JP / yMax) * 100;
                const intlH = (x.INTL / yMax) * 100;
                return (
                  <button
                    key={x.key}
                    className={mergeClasses(s.col, day !== null && day !== x.key ? s.dim : undefined)}
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    onClick={() => setDay(day === x.key ? null : x.key)}
                    aria-pressed={day === x.key}
                    aria-label={`${fmtDayLong(x.date)}: ${REGION_LABELS[lang].JP} ${x.JP}, ${REGION_LABELS[lang].INTL} ${x.INTL}`}
                  >
                    {x.INTL > 0 && (
                      <span
                        className={mergeClasses(s.seg, s.segTop, m.grow)}
                        style={{ height: `${intlH}%`, backgroundColor: colors.INTL, ...stagger(i, 14, 30) }}
                      />
                    )}
                    {x.JP > 0 && (
                      <span
                        className={mergeClasses(s.seg, x.INTL === 0 && s.segTop, m.grow)}
                        style={{ height: `${jpH}%`, backgroundColor: colors.JP, ...stagger(i, 14, 30) }}
                      />
                    )}
                    {total === 0 && <span style={{ height: 0 }} />}
                  </button>
                );
              })}
              {hover !== null && (
                <div className={s.tooltip} style={{ left: `${((hover + 0.5) / DAYS) * 100}%` }} role="status">
                  <div style={{ fontWeight: 600 }}>{fmtDayLong(series[hover].date)}</div>
                  {(["JP", "INTL"] as Region[]).map((r) => (
                    <div key={r}>
                      <span className={s.swatch} style={{ backgroundColor: colors[r] }} />
                      {REGION_LABELS[lang][r]} {series[hover][r]}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className={s.xAxis} aria-hidden>
              <span>{fmtDay(series[0].date)}</span>
              <span>{fmtDay(series[Math.floor(DAYS / 2)].date)}</span>
              <span>{fmtDay(series[DAYS - 1].date)}</span>
            </div>
          </div>

          {/* 화면 낭독기·표로 보고 싶은 사람을 위한 같은 데이터 */}
          <table className={s.srOnly}>
            <caption>{t.chartTitle}</caption>
            <tbody>
              {series.map((x) => (
                <tr key={x.key}>
                  <th>{fmtDayLong(x.date)}</th>
                  <td>
                    {REGION_LABELS[lang].JP} {x.JP}
                  </td>
                  <td>
                    {REGION_LABELS[lang].INTL} {x.INTL}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* 핵심 수치 */}
        <div className={s.stats}>
          <div className={mergeClasses(s.card, s.stat, s.statLead, m.enter)} style={stagger(1, 60)}>
            <Caption1 className={s.muted}>{t.incidents7d}</Caption1>
            <span className={mergeClasses(s.statNum, s.statLeadNum)}>{weekN}</span>
          </div>
          <div className={mergeClasses(s.card, s.stat, m.enter)} style={stagger(2, 60)}>
            <Caption1 className={s.muted}>{t.jpShare}</Caption1>
            <span className={s.statNum}>{jpN}</span>
            <Caption1 className={s.muted}>{pctOf(stats.jp)}</Caption1>
          </div>
          <div className={mergeClasses(s.card, s.stat, m.enter)} style={stagger(3, 60)}>
            <Caption1 className={s.muted}>{t.ransomShare}</Caption1>
            <span className={s.statNum}>{ransomN}</span>
            <Caption1 className={s.muted}>{pctOf(stats.ransom)}</Caption1>
          </div>
          <div className={mergeClasses(s.card, s.stat, m.enter)} style={stagger(4, 60)}>
            <Caption1 className={s.muted}>{t.leakShare}</Caption1>
            <span className={s.statNum}>{leakN}</span>
            <Caption1 className={s.muted}>{pctOf(stats.leak)}</Caption1>
          </div>
          <div className={mergeClasses(s.card, s.stat, m.enter)} style={stagger(5, 60)}>
            <Caption1 className={s.muted}>{t.topSector}</Caption1>
            <span className={s.statText}>{stats.topSector}</span>
          </div>
        </div>
      </div>

      <div className={ps.command}>
        <div className={ps.commandGroup}>
          {selectedDay ? (
            <span className={s.dayChip}>
              {t.dayFilter(fmtDayLong(selectedDay.date))}
              <Button
                appearance="transparent"
                size="small"
                icon={<DismissRegular />}
                aria-label={t.clearDay}
                onClick={() => setDay(null)}
              />
            </span>
          ) : (
            <Menu
              checkedValues={{ days: [String(days)] }}
              onCheckedValueChange={(_, d) => setDays(Number(d.checkedItems[0]))}
            >
              <MenuTrigger disableButtonEnhancement>
                <Button appearance="subtle" icon={<CalendarLtrRegular />}>
                  {t.periods[days] ?? `${days}`}
                  <ChevronDownRegular style={{ marginLeft: 4 }} />
                </Button>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  {PERIODS.map((d) => (
                    <MenuItemRadio key={d} name="days" value={String(d)}>
                      {t.periods[d] ?? `${d}`}
                    </MenuItemRadio>
                  ))}
                </MenuList>
              </MenuPopover>
            </Menu>
          )}
          <Text className={ps.count}>{t.count(list.length)}</Text>
        </div>
        {narrow && (
          <SearchBox
            className={ps.pageSearch}
            placeholder={t.search}
            value={p.query}
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
          selected={attack}
          onChange={setAttack}
          options={ATTACK_TYPES.map((v) => ({
            value: v,
            label: tagLabel(lang, v),
            count: inRegion.filter((x) => (x.attackTypes as string[]).includes(v)).length,
          }))}
        />
        <FilterPill
          name="sector"
          label={t.filterSector}
          anyLabel={t.any}
          clearLabel={t.resetAll}
          selected={sector}
          onChange={setSector}
          options={SECTORS.map((v) => ({
            value: v,
            label: tagLabel(lang, v),
            count: inRegion.filter((x) => (x.sectors as string[]).includes(v)).length,
          }))}
        />
      </div>

      {list.length === 0 ? (
        <div className={ps.empty}>
          <Subtitle1>{t.empty}</Subtitle1>
          <Text>{t.emptyHint}</Text>
        </div>
      ) : (
        <ul className={s.list} key={`${region}-${day}-${days}`}>
          {list.slice(0, 80).map((x, i) => {
            const d = new Date(x.firstSeen);
            const sel = x.id === p.selectedId;
            return (
              <li
                key={x.id}
                className={mergeClasses(s.row, sel && s.selected, m.enter)}
                style={stagger(i)}
                role="button"
                tabIndex={0}
                aria-current={sel ? "true" : undefined}
                onClick={() => p.onSelect(x.id)}
                onMouseEnter={() => setHoverRow(x.id)}
                onMouseLeave={() => setHoverRow(null)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    p.onSelect(x.id);
                  }
                }}
              >
                <div className={s.when}>
                  <span className={s.whenDate}>
                    {isLive(x) && <span className={mergeClasses(s.live, m.pulse)} aria-hidden />}
                    {shortDate(lang, x.firstSeen)}
                  </span>
                  <span>{timeOfDay(lang, x.firstSeen)}</span>
                </div>
                <div className={s.body}>
                  {x.entities.orgs.length > 0 && (
                    <div className={s.orgs}>
                      {t.orgsLabel} · {x.entities.orgs.slice(0, 3).join(", ")}
                    </div>
                  )}
                  <div className={s.title}>{title(x)}</div>
                  {summary(x) && <div className={s.summary}>{summary(x)}</div>}
                  <div className={s.meta}>
                    {x.importance >= PRIORITY_THRESHOLD && <span className={s.priority}>{t.priority}</span>}
                    <span className={s.metaWhen}>
                      {isLive(x) && <span className={mergeClasses(s.live, m.pulse)} aria-hidden />}
                      {fmtDay(d)}
                    </span>
                    <span>{x.regions.map((r) => REGION_LABELS[lang][r]).join(" · ")}</span>
                    {x.sectors.length > 0 && <span>{x.sectors.map((v) => tagLabel(lang, v)).join(", ")}</span>}
                    {x.attackTypes.length > 0 && <span>{x.attackTypes.map((v) => tagLabel(lang, v)).join(", ")}</span>}
                    <span>{x.sources.length > 1 ? t.sourcesCount(x.sources.length) : x.sources[0]}</span>
                  </div>
                </div>
                <ChevronRightRegular
                  className={mergeClasses(s.chevron, (hoverRow === x.id || sel) && s.chevronOn)}
                  aria-hidden
                />
              </li>
            );
          })}
        </ul>
      )}

      <Caption1 className={ps.footer}>{t.footer}</Caption1>
    </div>
  );
}
