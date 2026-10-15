// 오늘의 브리핑: 첫 화면. 위쪽 배너에 AI 헤드라인, 왼쪽에 오늘의 항목 카드,
// 오른쪽에 주목 인시던트·새 KEV·많이 언급된 위협 그룹 위젯 (넓은 화면에서 빈 공간을 정보로 채운다).
import {
  Button,
  Caption1,
  Menu,
  MenuItemRadio,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Subtitle1,
  Subtitle2,
  Text,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import {
  AlertUrgentRegular,
  ArrowRightRegular,
  ChevronDownRegular,
  HistoryRegular,
  LightbulbRegular,
  PeopleTeamRegular,
  ShieldErrorRegular,
  SparkleFilled,
  type FluentIcon,
} from "@fluentui/react-icons";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Briefing, Topic, VulnData } from "../../shared/types";
import { LOCALE, REGION_LABELS, STRINGS, type Lang } from "../i18n";
import type { View } from "./AppNav";
import { relativeTime } from "./format";
import { NatureMark, NatureTile } from "./marks";
import { stagger, useMotion } from "./motion";
import { usePageStyles } from "./page";
import { rankScore } from "./TopicsPage";

const useStyles = makeStyles({
  page: { maxWidth: "1320px" },
  // ── 배너 ──
  hero: {
    position: "relative",
    overflow: "hidden",
    padding: "28px 32px 30px",
    borderRadius: tokens.borderRadiusXLarge,
    color: "#fff",
    backgroundImage: [
      "radial-gradient(900px 320px at 100% 0%, rgba(160, 110, 240, 0.55), transparent 60%)",
      "radial-gradient(700px 280px at 0% 100%, rgba(40, 140, 240, 0.55), transparent 60%)",
      "linear-gradient(120deg, #0c3b5e 0%, #0f548c 40%, #4a3a9c 100%)",
    ].join(", "),
    boxShadow: tokens.shadow8,
    "@media (max-width: 640px)": { padding: "20px 18px 22px", borderRadius: tokens.borderRadiusLarge },
    // 처음 열 때 빛이 한 번 지나가고 멈춘다
    "::after": {
      content: '""',
      position: "absolute",
      inset: 0,
      backgroundImage: "linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%)",
      transform: "translateX(-100%)",
      animationName: { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(100%)" } },
      animationDuration: "1.4s",
      animationDelay: "250ms",
      animationTimingFunction: tokens.curveEasyEase,
      animationIterationCount: 1,
      animationFillMode: "forwards",
      pointerEvents: "none",
      "@media (prefers-reduced-motion: reduce)": { animationName: "none", display: "none" },
    },
  },
  heroDeco: {
    position: "absolute",
    right: "-24px",
    top: "-28px",
    fontSize: "200px",
    color: "rgba(255,255,255,0.08)",
    pointerEvents: "none",
    "@media (max-width: 640px)": { display: "none" },
  },
  heroTop: {
    position: "relative",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
  aiChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    height: "24px",
    padding: "0 10px",
    borderRadius: "12px",
    backgroundColor: "rgba(255,255,255,0.16)",
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
  },
  heroDate: { color: "rgba(255,255,255,0.8)", marginLeft: "10px" },
  heroTitle: {
    position: "relative",
    margin: "14px 0 8px",
    fontSize: tokens.fontSizeHero800,
    lineHeight: tokens.lineHeightHero800,
    fontWeight: tokens.fontWeightSemibold,
    "@media (max-width: 640px)": { fontSize: tokens.fontSizeBase600, lineHeight: tokens.lineHeightBase600 },
  },
  heroText: {
    position: "relative",
    margin: 0,
    maxWidth: "760px",
    fontSize: "17px",
    lineHeight: "28px",
    color: "rgba(255,255,255,0.95)",
  },
  heroBtn: {
    color: "#fff",
    ":hover": { color: "#fff", backgroundColor: "rgba(255,255,255,0.14)" },
    ":hover:active": { color: "#fff", backgroundColor: "rgba(255,255,255,0.22)" },
  },
  // ── 본문 2단 ──
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: "20px",
    marginTop: "20px",
    "@media (min-width: 1180px)": { gridTemplateColumns: "minmax(0, 1fr) 340px", alignItems: "start" },
  },
  items: { display: "flex", flexDirection: "column", gap: "12px", margin: 0, padding: 0, listStyle: "none" },
  item: {
    display: "grid",
    gridTemplateColumns: "40px 1fr",
    gap: "0 16px",
    padding: "20px 24px",
    "@media (max-width: 640px)": { gridTemplateColumns: "1fr", padding: "16px" },
  },
  itemSide: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
    "@media (max-width: 640px)": { flexDirection: "row", marginBottom: "8px" },
  },
  num: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    fontWeight: tokens.fontWeightSemibold,
    fontVariantNumeric: "tabular-nums",
  },
  meta: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px 12px",
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  title: {
    margin: "6px 0 8px",
    fontSize: "18px",
    lineHeight: "26px",
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  body: { fontSize: "15px", lineHeight: "26px", color: tokens.colorNeutralForeground1, margin: 0 },
  why: {
    display: "flex",
    gap: "8px",
    alignItems: "flex-start",
    marginTop: "12px",
    padding: "10px 12px",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase300,
    lineHeight: "22px",
  },
  whyIcon: { color: tokens.colorPaletteMarigoldForeground1, fontSize: "18px", flexShrink: 0, marginTop: "2px" },
  whyLabel: { fontWeight: tokens.fontWeightSemibold, color: tokens.colorNeutralForeground1, marginRight: "6px" },
  more: { marginTop: "8px", marginLeft: "-8px" },
  // ── 오른쪽 위젯 ──
  rail: { display: "flex", flexDirection: "column", gap: "12px" },
  widget: { padding: "16px 18px" },
  widgetHead: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" },
  widgetIcon: {
    width: "28px",
    height: "28px",
    borderRadius: tokens.borderRadiusMedium,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "16px",
    flexShrink: 0,
  },
  widgetTitle: { flex: 1, minWidth: 0 },
  widgetSub: { display: "block", color: tokens.colorNeutralForeground3 },
  wList: { margin: 0, padding: 0, listStyle: "none" },
  wItem: {
    display: "block",
    width: "100%",
    padding: "8px 8px",
    margin: "0 -8px",
    border: "none",
    borderRadius: tokens.borderRadiusMedium,
    background: "none",
    font: "inherit",
    textAlign: "left",
    color: "inherit",
    cursor: "pointer",
    transitionProperty: "background-color",
    transitionDuration: tokens.durationFaster,
    ":hover": { backgroundColor: tokens.colorSubtleBackgroundHover },
    ":focus-visible": { outline: `2px solid ${tokens.colorStrokeFocus2}` },
  },
  wOrg: {
    display: "block",
    fontSize: tokens.fontSizeBase200,
    lineHeight: "16px",
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorPaletteRedForeground1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  wTitle: {
    display: "-webkit-box",
    WebkitLineClamp: "2",
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    fontSize: tokens.fontSizeBase300,
    lineHeight: "20px",
    color: tokens.colorNeutralForeground1,
  },
  wMeta: {
    display: "block",
    marginTop: "2px",
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  wCve: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
  },
  chips: { display: "flex", flexWrap: "wrap", gap: "6px" },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    height: "26px",
    padding: "0 10px",
    borderRadius: "13px",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    font: "inherit",
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground1,
    cursor: "pointer",
    transitionProperty: "background-color, border-color",
    transitionDuration: tokens.durationFaster,
    ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover },
    ":focus-visible": { outline: `2px solid ${tokens.colorStrokeFocus2}` },
  },
  chipCount: { color: tokens.colorNeutralForeground3, fontVariantNumeric: "tabular-nums" },
  empty: { color: tokens.colorNeutralForeground3 },
});

interface Props {
  lang: Lang;
  briefings: Briefing[];
  topics: Topic[];
  vulns: VulnData | null;
  onOpen: (topicId: string) => void;
  onVuln: (cve: string) => void;
  onSearch: (q: string) => void;
  onGo: (view: View) => void;
  onOrder: (ids: string[]) => void;
}

function Widget(p: {
  icon: FluentIcon;
  tint: { bg: string; fg: string };
  title: string;
  sub: string;
  action?: { label: string; onClick: () => void };
  index: number;
  children: ReactNode;
}) {
  const s = useStyles();
  const ps = usePageStyles();
  const m = useMotion();
  const Icon = p.icon;
  return (
    <section className={mergeClasses(ps.surface, s.widget, m.enter)} style={stagger(p.index + 2, 80)}>
      <div className={s.widgetHead}>
        <span className={s.widgetIcon} style={{ backgroundColor: p.tint.bg, color: p.tint.fg }} aria-hidden>
          <Icon />
        </span>
        <div className={s.widgetTitle}>
          <Subtitle2>{p.title}</Subtitle2>
          <Caption1 className={s.widgetSub}>{p.sub}</Caption1>
        </div>
        {p.action && (
          <Button size="small" appearance="transparent" onClick={p.action.onClick}>
            {p.action.label}
          </Button>
        )}
      </div>
      {p.children}
    </section>
  );
}

export function BriefingPage(p: Props) {
  const { lang, briefings, topics } = p;
  const s = useStyles();
  const ps = usePageStyles();
  const m = useMotion();
  const t = STRINGS[lang];
  const [date, setDate] = useState<string | null>(null);
  const b = briefings.find((x) => x.date === date) ?? briefings[0];
  const byId = useMemo(() => new Map(topics.map((x) => [x.id, x])), [topics]);

  const ids = useMemo(() => (b ? b.items.map((i) => i.topicId).filter((id) => byId.has(id)) : []), [b, byId]);
  useEffect(() => p.onOrder(ids), [ids]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 오른쪽 위젯 데이터 (최근 7일) ──
  const rail = useMemo(() => {
    const since = Date.now() - 7 * 86400_000;
    const recent = topics.filter((x) => Date.parse(x.lastUpdated) >= since);
    const now = Date.now();
    const incidents = recent
      .filter((x) => x.nature === "사건")
      .sort((a, b2) => rankScore(b2, now) - rankScore(a, now))
      .slice(0, 5);
    const kevAll = p.vulns?.kev ?? [];
    const kevWeek = kevAll.filter((k) => Date.parse(k.dateAdded) >= since);
    const kev = (kevWeek.length ? kevWeek : kevAll).slice(0, 5);
    const actorCount = new Map<string, number>();
    for (const x of recent) for (const a of x.entities.actors) actorCount.set(a, (actorCount.get(a) ?? 0) + 1);
    const actors = [...actorCount.entries()].sort((a, b2) => b2[1] - a[1]).slice(0, 12);
    return { incidents, kev, actors };
  }, [topics, p.vulns]);

  const fmtDate = (d: string) =>
    new Intl.DateTimeFormat(LOCALE[lang], { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(
      new Date(`${d}T00:00:00+09:00`),
    );
  const topicTitle = (x: Topic) => (lang === "ja" ? x.titleJa || x.titleKo : x.titleKo);

  return (
    <div className={mergeClasses(ps.page, s.page)}>
      {/* 배너 */}
      <header className={mergeClasses(s.hero, m.enter)} key={b?.date ?? "none"}>
        <SparkleFilled className={s.heroDeco} aria-hidden />
        <div className={s.heroTop}>
          <span>
            <span className={s.aiChip}>
              <SparkleFilled aria-hidden />
              {t.aiGenerated}
            </span>
            {b && <span className={s.heroDate}>{fmtDate(b.date)}</span>}
          </span>
          {briefings.length > 1 && (
            <Menu checkedValues={{ date: [b?.date ?? ""] }} onCheckedValueChange={(_, d) => setDate(d.checkedItems[0])}>
              <MenuTrigger disableButtonEnhancement>
                <Button appearance="transparent" className={s.heroBtn} icon={<HistoryRegular />}>
                  {t.briefingArchive}
                  <ChevronDownRegular style={{ marginLeft: 4 }} />
                </Button>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  {briefings.map((x) => (
                    <MenuItemRadio key={x.date} name="date" value={x.date}>
                      {fmtDate(x.date)}
                    </MenuItemRadio>
                  ))}
                </MenuList>
              </MenuPopover>
            </Menu>
          )}
        </div>
        <h1 className={s.heroTitle}>{t.briefingTitle}</h1>
        <p className={s.heroText}>{b ? (lang === "ja" ? b.headlineJa : b.headlineKo) : t.briefingEmpty}</p>
      </header>

      <div className={s.grid}>
        {/* 오늘의 항목 */}
        {b ? (
          <ol className={s.items} key={`list-${b.date}`}>
            {b.items.map((it, i) => {
              const topic = byId.get(it.topicId);
              return (
                <li key={it.topicId} className={mergeClasses(ps.surface, s.item, m.enter)} style={stagger(i + 1, 90)}>
                  <div className={s.itemSide}>
                    <span className={s.num} aria-hidden>
                      {i + 1}
                    </span>
                    {topic && <NatureTile nature={topic.nature} size={32} />}
                  </div>
                  <div>
                    {topic && (
                      <div className={s.meta}>
                        <NatureMark nature={topic.nature} lang={lang} />
                        <span>{topic.regions.map((r) => REGION_LABELS[lang][r]).join(" · ")}</span>
                        <span>{t.sourcesCount(topic.sources.length)}</span>
                      </div>
                    )}
                    <h2 className={s.title}>{lang === "ja" ? it.titleJa : it.titleKo}</h2>
                    <p className={s.body}>{lang === "ja" ? it.bodyJa : it.bodyKo}</p>
                    <div className={s.why}>
                      <LightbulbRegular className={s.whyIcon} aria-hidden />
                      <span>
                        <span className={s.whyLabel}>{t.briefingWhy}</span>
                        {lang === "ja" ? it.whyJa : it.whyKo}
                      </span>
                    </div>
                    {topic && (
                      <Button
                        className={s.more}
                        appearance="transparent"
                        icon={<ArrowRightRegular />}
                        iconPosition="after"
                        onClick={() => p.onOpen(topic.id)}
                      >
                        {t.briefingMore}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className={mergeClasses(ps.surface, ps.empty)}>
            <Subtitle1>{t.briefingEmpty}</Subtitle1>
            <Text>{t.briefingSub}</Text>
          </div>
        )}

        {/* 오른쪽 위젯 */}
        <aside className={s.rail}>
          <Widget
            index={0}
            icon={AlertUrgentRegular}
            tint={{ bg: tokens.colorPaletteRedBackground1, fg: tokens.colorPaletteRedForeground1 }}
            title={t.railIncidents}
            sub={t.railWindow}
            action={{ label: t.viewAll, onClick: () => p.onGo("incidents") }}
          >
            {rail.incidents.length === 0 ? (
              <Caption1 className={s.empty}>{t.noneYet}</Caption1>
            ) : (
              <ul className={s.wList}>
                {rail.incidents.map((x) => (
                  <li key={x.id}>
                    <button className={s.wItem} onClick={() => p.onOpen(x.id)}>
                      {x.entities.orgs.length > 0 && (
                        <span className={s.wOrg}>{x.entities.orgs.slice(0, 2).join(", ")}</span>
                      )}
                      <span className={s.wTitle}>{topicTitle(x)}</span>
                      <span className={s.wMeta}>
                        {x.regions.map((r) => REGION_LABELS[lang][r]).join(" · ")} · {relativeTime(lang, x.lastUpdated)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Widget>

          <Widget
            index={1}
            icon={ShieldErrorRegular}
            tint={{ bg: tokens.colorPaletteDarkOrangeBackground1, fg: tokens.colorPaletteDarkOrangeForeground1 }}
            title={t.railKev}
            sub="CISA KEV"
            action={{ label: t.viewAll, onClick: () => p.onGo("kev") }}
          >
            <ul className={s.wList}>
              {rail.kev.map((k) => (
                <li key={k.cveID}>
                  <button className={s.wItem} onClick={() => p.onVuln(k.cveID)}>
                    <span className={s.wCve}>{k.cveID}</span>
                    <span className={s.wMeta}>
                      {k.vendorProject} · {k.product} · {k.dateAdded}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Widget>

          <Widget
            index={2}
            icon={PeopleTeamRegular}
            tint={{ bg: tokens.colorPaletteBerryBackground1, fg: tokens.colorPaletteBerryForeground1 }}
            title={t.railActors}
            sub={t.railWindow}
          >
            {rail.actors.length === 0 ? (
              <Caption1 className={s.empty}>{t.noneYet}</Caption1>
            ) : (
              <div className={s.chips}>
                {rail.actors.map(([name, n]) => (
                  <button key={name} className={s.chip} onClick={() => p.onSearch(name)}>
                    {name}
                    <span className={s.chipCount}>{n}</span>
                  </button>
                ))}
              </div>
            )}
          </Widget>
        </aside>
      </div>

      {b && <Caption1 className={ps.footer}>{t.aiNotice}</Caption1>}
    </div>
  );
}
