// 인시던트: 실제 침해 사고(성격 '사건') 토픽만 모아 보는 화면.
// 위쪽에 최근 7일 핵심 수치 타일, 아래에 관련 조직이 먼저 보이는 목록 (앞에 달력 모양 날짜 타일).
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
import {
  CalendarLtrRegular,
  ChevronDownRegular,
  ChevronRightRegular,
} from "@fluentui/react-icons";
import { useEffect, useMemo, useState } from "react";
import { ATTACK_TYPES, SECTORS, type Region } from "../../shared/taxonomy";
import type { LeakPost, Topic } from "../../shared/types";
import { LOCALE, REGION_LABELS, STRINGS, tagLabel, type Lang } from "../i18n";
import { FilterPill } from "./FilterPill";
import { timeOfDay } from "./format";
import { FreshMark, SourceAvatars } from "./marks";
import { stagger, useCountUp, useMotion } from "./motion";
import { PageTitle, usePageStyles } from "./page";
import { LeaksSection } from "./Leaks";
import { namesOf, sourceLabel, summaryOf, titleOf } from "./text";
import { isFresh } from "./visit";
import { PRIORITY_THRESHOLD, matchesQuery } from "./TopicsPage";
import { nb } from "./NoBreak";

const PERIODS = [7, 30, 90];

const PAGE = 50;

const useStyles = makeStyles({
  regionTabs: { marginTop: "12px", marginLeft: "-10px" },
  // 수치 타일 (D안): 첫 칸은 두 배 폭 + 배너 그라데이션 + 최근 7일 막대, 나머지는 색 숫자만
  stats: {
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    gap: "12px",
    margin: "16px 0 8px",
    "@media (max-width: 1100px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" },
    // 휴대폰: 대표 칸이 한 줄 전체, 나머지 넷이 2×2
    "@media (max-width: 640px)": { gridTemplateColumns: "1fr 1fr", gap: "8px" },
  },
  stat: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    padding: "14px 16px",
    minWidth: 0,
    "@media (max-width: 640px)": { padding: "10px 12px" },
  },
  statLabel: { color: tokens.colorNeutralForeground3 },
  statNum: {
    fontSize: tokens.fontSizeHero700,
    lineHeight: tokens.lineHeightHero700,
    fontWeight: tokens.fontWeightSemibold,
    fontVariantNumeric: "tabular-nums",
  },
  statText: {
    fontSize: tokens.fontSizeBase500,
    lineHeight: tokens.lineHeightHero700,
    fontWeight: tokens.fontWeightSemibold,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  statSub: { color: tokens.colorNeutralForeground3 },
  // 대표 칸
  hero: {
    gridColumn: "span 2",
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    alignItems: "end",
    gap: "16px",
    padding: "16px 18px",
    borderRadius: tokens.borderRadiusXLarge,
    color: "#fff",
    backgroundImage: "linear-gradient(120deg, #0c3b5e 0%, #0f548c 40%, #4a3a9c 100%)",
    boxShadow: tokens.shadow8,
    "@media (max-width: 1100px)": { gridColumn: "span 4" },
    "@media (max-width: 640px)": { gridColumn: "1 / -1", padding: "14px 16px" },
  },
  heroText: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 },
  heroLabel: { color: "rgba(255,255,255,0.85)", fontWeight: tokens.fontWeightSemibold },
  heroNum: {
    fontSize: "40px",
    lineHeight: "46px",
    fontWeight: tokens.fontWeightBold,
    fontVariantNumeric: "tabular-nums",
  },
  // 최근 7일 막대 (오늘이 맨 오른쪽, 오늘만 흰색)
  bars: {
    display: "flex",
    alignItems: "flex-end",
    gap: "4px",
    height: "56px",
    justifySelf: "end",
    width: "100%",
    maxWidth: "190px",
  },
  bar: {
    flex: 1,
    minHeight: "3px",
    borderRadius: "2px 2px 0 0",
    backgroundColor: "rgba(255,255,255,0.35)",
    ":last-child": { backgroundColor: "#fff" },
  },
  // 목록
  list: { margin: 0, listStyle: "none" },
  row: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "44px 1fr",
    gap: "0 14px",
    padding: "16px 12px",
    margin: "0 -12px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
    borderRadius: tokens.borderRadiusMedium,
    cursor: "pointer",
    transitionProperty: "background-color",
    transitionDuration: tokens.durationFaster,
    "@media (min-width: 641px)": { gridTemplateColumns: "52px 1fr 20px" },
    ":last-child": { borderBottom: "none" },
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
  // 달력 모양 날짜 타일
  dateWrap: { position: "relative", alignSelf: "start" },
  date: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    overflow: "hidden",
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    fontVariantNumeric: "tabular-nums",
  },
  dateMonth: {
    width: "100%",
    textAlign: "center",
    padding: "1px 0",
    fontSize: tokens.fontSizeBase100,
    lineHeight: "14px",
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForegroundOnBrand,
    backgroundColor: tokens.colorPaletteRedBackground3,
  },
  dateDay: {
    fontSize: "20px",
    lineHeight: "28px",
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  live: {
    position: "absolute",
    top: "-3px",
    right: "-3px",
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    border: `2px solid ${tokens.colorNeutralBackground1}`,
    backgroundColor: tokens.colorPaletteRedBackground3,
  },
  body: { minWidth: 0 },
  orgs: {
    fontSize: tokens.fontSizeBase200,
    lineHeight: "18px",
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorPaletteRedForeground1,
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
  metaIcon: { display: "inline-flex", alignItems: "center", gap: "6px" },
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

interface Props {
  lang: Lang;
  topics: Topic[];
  /** 랜섬웨어 유출 사이트 게시 (일본) */
  leaks: LeakPost[];
  /** 지난 방문 시각 (새 소식 표시) */
  lastVisit: number | null;
  query: string;
  setQuery: (q: string) => void;
  narrow: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOrder: (ids: string[]) => void;
}

function StatTile(p: {
  label: string;
  value?: number;
  text?: string;
  sub?: string;
  /** 숫자 색 (테마 토큰이라 다크 모드에서도 맞는다) */
  color: string;
  index: number;
}) {
  const s = useStyles();
  const ps = usePageStyles();
  const m = useMotion();
  const n = useCountUp(p.value ?? 0);
  return (
    <div className={mergeClasses(ps.surface, s.stat, m.enter)} style={stagger(p.index, 50)}>
      <Caption1 className={s.statLabel}>{p.label}</Caption1>
      {p.text !== undefined ? (
        <span className={s.statText} style={{ color: p.color }} title={p.text}>
          {p.text}
        </span>
      ) : (
        <span className={s.statNum} style={{ color: p.color }}>
          {n}
        </span>
      )}
      {p.sub && <Caption1 className={s.statSub}>{p.sub}</Caption1>}
    </div>
  );
}

/** 대표 칸: 최근 7일 인시던트 수 + 일별 막대 */
function HeroStat(p: { lang: Lang; label: string; value: number; daily: { day: Date; n: number }[] }) {
  const s = useStyles();
  const m = useMotion();
  const t = STRINGS[p.lang];
  const n = useCountUp(p.value);
  const max = Math.max(1, ...p.daily.map((d) => d.n));
  const fmt = new Intl.DateTimeFormat(LOCALE[p.lang], { month: "numeric", day: "numeric" });
  const desc = p.daily.map((d) => `${fmt.format(d.day)} ${t.count(d.n)}`).join(", ");
  return (
    <div className={mergeClasses(s.hero, m.enter)} style={stagger(0, 50)}>
      <div className={s.heroText}>
        <Caption1 className={s.heroLabel}>{p.label}</Caption1>
        <span className={s.heroNum}>{n}</span>
      </div>
      <div className={s.bars} role="img" aria-label={desc}>
        {p.daily.map((d) => (
          <span
            key={d.day.getTime()}
            className={s.bar}
            style={{ height: `${Math.max(6, (d.n / max) * 100)}%` }}
            title={`${fmt.format(d.day)} · ${t.count(d.n)}`}
          />
        ))}
      </div>
    </div>
  );
}

export function IncidentsPage(p: Props) {
  const { lang, narrow } = p;
  const s = useStyles();
  const ps = usePageStyles();
  const m = useMotion();
  const t = STRINGS[lang];

  const [region, setRegion] = useState<"all" | Region>("all");
  const [days, setDays] = useState(30);
  const [attack, setAttack] = useState<string[]>([]);
  const [sector, setSector] = useState<string[]>([]);
  const [hoverRow, setHoverRow] = useState<string | null>(null);

  const incidents = useMemo(() => p.topics.filter((x) => x.nature === "사건"), [p.topics]);
  const inRegion = useMemo(
    () => incidents.filter((x) => region === "all" || x.regions.includes(region)),
    [incidents, region],
  );

  // ── 최근 7일 수치 ──
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
      topSectorN: top?.[1] ?? 0,
      // 최근 7일 일별 (이 브라우저의 날짜 기준, 오늘이 마지막)
      daily: Array.from({ length: 7 }, (_, i) => {
        const day = new Date();
        day.setHours(0, 0, 0, 0);
        day.setDate(day.getDate() - (6 - i));
        const end = day.getTime() + 86400_000;
        return {
          day,
          n: inRegion.filter((x) => {
            const at = Date.parse(x.firstSeen);
            return at >= day.getTime() && at < end;
          }).length,
        };
      }),
    };
  }, [inRegion, lang, t.noSector]);
  const pctOf = (n: number) => (stats.week ? `${Math.round((n / stats.week) * 100)}%` : "–");

  // ── 목록 ──
  const list = useMemo(() => {
    const since = Date.now() - days * 86400_000;
    return inRegion
      .filter(
        (x) =>
          Date.parse(x.lastUpdated) >= since &&
          matchesQuery(x, p.query) &&
          attack.every((a) => (x.attackTypes as string[]).includes(a)) &&
          (sector.length === 0 || sector.some((v) => (x.sectors as string[]).includes(v))),
      )
      .sort((a, b) => b.firstSeen.localeCompare(a.firstSeen));
  }, [inRegion, days, p.query, attack, sector]);

  // 한 번에 PAGE개씩 그리고 '더 보기'로 늘린다 (예전엔 80개에서 잘려 나머지를 볼 수 없었다)
  const [shown, setShown] = useState(PAGE);
  useEffect(() => setShown(PAGE), [region, days, p.query, attack, sector]);
  const visible = useMemo(() => list.slice(0, shown), [list, shown]);
  const ids = useMemo(() => visible.map((x) => x.id), [visible]);
  useEffect(() => p.onOrder(ids), [ids]); // eslint-disable-line react-hooks/exhaustive-deps

  const month = (d: Date) => new Intl.DateTimeFormat(LOCALE[lang], { month: "short" }).format(d);
  const title = (x: Topic) => titleOf(lang, x);
  const summary = (x: Topic) => summaryOf(lang, x)[0] ?? "";
  const isLive = (x: Topic) => Date.now() - Date.parse(x.lastUpdated) < 86400_000;

  return (
    <div className={mergeClasses(ps.page, ps.reading)}>
      <PageTitle>{t.incidentsTitle}</PageTitle>
      <Text className={ps.desc}>{t.incidentsDesc}</Text>

      <TabList
        className={s.regionTabs}
        selectedValue={region}
        onTabSelect={(_, d) => setRegion(d.value as "all" | Region)}
      >
        <Tab value="all">{t.regionAll}</Tab>
        <Tab value="JP">{REGION_LABELS[lang].JP}</Tab>
        <Tab value="INTL">{REGION_LABELS[lang].INTL}</Tab>
      </TabList>

      <div className={s.stats} key={region}>
        <HeroStat lang={lang} label={t.incidents7d} value={stats.week} daily={stats.daily} />
        <StatTile index={1} color={tokens.colorBrandForeground1} label={t.jpShare} value={stats.jp} sub={pctOf(stats.jp)} />
        <StatTile
          index={2}
          color={tokens.colorPaletteBerryForeground1}
          label={t.ransomShare}
          value={stats.ransom}
          sub={pctOf(stats.ransom)}
        />
        <StatTile
          index={3}
          color={tokens.colorPaletteDarkOrangeForeground1}
          label={t.leakShare}
          value={stats.leak}
          sub={pctOf(stats.leak)}
        />
        <StatTile
          index={4}
          color={tokens.colorPaletteTealForeground2}
          label={t.topSector}
          text={stats.topSector}
          sub={stats.topSectorN ? t.count(stats.topSectorN) : undefined}
        />
      </div>

      <div className={ps.command}>
        <div className={ps.commandGroup}>
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

      {region !== "INTL" && <LeaksSection lang={lang} leaks={p.leaks} limit={5} onOpen={p.onSelect} />}

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
        <ul className={mergeClasses(s.list, ps.listSurface)} key={`${region}-${days}`}>
          {visible.map((x, i) => {
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
                <span className={s.dateWrap}>
                  <time className={s.date} dateTime={x.firstSeen} style={{ width: narrow ? 44 : 52 }}>
                    <span className={s.dateMonth}>{month(d)}</span>
                    <span className={s.dateDay}>{d.getDate()}</span>
                  </time>
                  {isLive(x) && <span className={mergeClasses(s.live, m.pulse)} aria-hidden />}
                </span>
                <div className={s.body}>
                  {namesOf(lang, x.entities.orgs).length > 0 && (
                    <div className={s.orgs}>
                      {t.orgsLabel} · {namesOf(lang, x.entities.orgs).slice(0, 3).join(", ")}
                    </div>
                  )}
                  <div className={s.title}>{nb(title(x))}</div>
                  {summary(x) && <div className={s.summary}>{nb(summary(x))}</div>}
                  <div className={s.meta}>
                    {isFresh(x, p.lastVisit) && <FreshMark lang={lang} />}
                    {x.importance >= PRIORITY_THRESHOLD && <span className={s.priority}>{t.priority}</span>}
                    <span>{timeOfDay(lang, x.firstSeen)}</span>
                    <span>{x.regions.map((r) => REGION_LABELS[lang][r]).join(" · ")}</span>
                    {x.sectors.length > 0 && <span>{x.sectors.map((v) => tagLabel(lang, v)).join(", ")}</span>}
                    {x.attackTypes.length > 0 && <span>{x.attackTypes.map((v) => tagLabel(lang, v)).join(", ")}</span>}
                    {x.sources.length > 1 ? (
                      <span className={s.metaIcon}>
                        <SourceAvatars sources={x.sources.map((n) => sourceLabel(lang, n))} />
                        {t.sourcesCount(x.sources.length)}
                      </span>
                    ) : (
                      <span>{sourceLabel(lang, x.sources[0])}</span>
                    )}
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

      {list.length > shown && (
        <div className={ps.more}>
          <Button onClick={() => setShown(shown + PAGE)}>{t.more(list.length - shown)}</Button>
        </div>
      )}

      <Caption1 className={ps.footer}>{t.footer}</Caption1>
    </div>
  );
}
