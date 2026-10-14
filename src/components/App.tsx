import {
  Body1,
  Button,
  Caption1,
  CounterBadge,
  FluentProvider,
  MessageBar,
  MessageBarBody,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Spinner,
  Subtitle1,
  Tab,
  TabList,
  Text,
  Title2,
  makeStyles,
  tokens,
  webDarkTheme,
  webLightTheme,
  type Theme,
} from "@fluentui/react-components";
import { CheckmarkCircleRegular, DismissCircleRegular, InfoRegular } from "@fluentui/react-icons";
import { useEffect, useMemo, useState } from "react";
import { REGIONS, REGION_LABEL, type Region } from "../../shared/taxonomy";
import type { Meta, NewsItem, VulnData } from "../../shared/types";
import { NewsView, EMPTY_FILTERS, type NewsFilters } from "./NewsView";
import { VulnView } from "./VulnView";
import { fullDateTime, relativeTime } from "./format";

const FONT = `"Segoe UI Variable Text", "Segoe UI", "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", "Hiragino Sans", "Yu Gothic UI", system-ui, sans-serif`;
const lightTheme: Theme = { ...webLightTheme, fontFamilyBase: FONT };
const darkTheme: Theme = { ...webDarkTheme, fontFamilyBase: FONT };

type TabKey = "all" | Region | "vuln";
const TAB_KEYS: TabKey[] = ["all", ...REGIONS, "vuln"];

const useStyles = makeStyles({
  page: {
    minHeight: "100vh",
    backgroundColor: tokens.colorNeutralBackground2,
  },
  shell: {
    maxWidth: "1280px",
    margin: "0 auto",
    padding: "24px 16px 64px",
    "@media (min-width: 720px)": { padding: "32px 32px 64px" },
  },
  header: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "12px",
  },
  subtitle: { color: tokens.colorNeutralForeground3, display: "block", marginTop: "4px" },
  updated: { display: "flex", alignItems: "center", gap: "4px", color: tokens.colorNeutralForeground3 },
  stats: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
    gap: "12px",
    margin: "20px 0 8px",
  },
  stat: {
    padding: "12px 16px",
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow2,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  statLabel: { color: tokens.colorNeutralForeground3 },
  tabs: {
    margin: "12px 0 16px",
    overflowX: "auto",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  center: { display: "flex", justifyContent: "center", padding: "80px 0" },
  sources: { display: "flex", flexDirection: "column", gap: "6px", maxWidth: "320px" },
  sourceRow: { display: "flex", alignItems: "center", gap: "6px" },
  ok: { color: tokens.colorPaletteGreenForeground1 },
  bad: { color: tokens.colorPaletteRedForeground1 },
  footer: { marginTop: "40px", color: tokens.colorNeutralForeground3, display: "block" },
});

function usePrefersDark(): boolean {
  const query = "(prefers-color-scheme: dark)";
  const [dark, setDark] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const fn = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return dark;
}

async function load<T>(name: string): Promise<T | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL.replace(/\/?$/, "/")}data/${name}`, { cache: "no-cache" });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

function readUrl(): { tab: TabKey; q: string } {
  const p = new URLSearchParams(location.search);
  const tab = p.get("tab") as TabKey;
  return { tab: TAB_KEYS.includes(tab) ? tab : "all", q: p.get("q") ?? "" };
}

export default function App() {
  const s = useStyles();
  const dark = usePrefersDark();
  const initial = useMemo(readUrl, []);

  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [vulns, setVulns] = useState<VulnData | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [tab, setTab] = useState<TabKey>(initial.tab);
  const [filters, setFilters] = useState<NewsFilters>({ ...EMPTY_FILTERS, q: initial.tab === "vuln" ? "" : initial.q });
  const [vulnQuery, setVulnQuery] = useState(initial.tab === "vuln" ? initial.q : "");

  useEffect(() => {
    // 개발 서버에서는 scripts/dev/dev-fixture.ts가 만든 임시 데이터가 있으면 그걸 쓴다
    const devNews = import.meta.env.DEV ? load<NewsItem[]>("news.dev.json") : Promise.resolve(null);
    devNews.then((d) => d ?? load<NewsItem[]>("news.json")).then((d) => setNews(d ?? []));
    load<VulnData>("vulns.json").then(setVulns);
    load<Meta>("meta.json").then(setMeta);
  }, []);

  // 탭과 검색어를 주소에 남겨서 링크로 공유·북마크할 수 있게 한다
  useEffect(() => {
    const p = new URLSearchParams();
    if (tab !== "all") p.set("tab", tab);
    const q = tab === "vuln" ? vulnQuery : filters.q;
    if (q) p.set("q", q);
    const qs = p.toString();
    history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
  }, [tab, filters.q, vulnQuery]);

  const counts = useMemo(() => {
    const c: Record<Region, number> = { INTL: 0, JP: 0, KR: 0 };
    for (const n of news ?? []) for (const r of n.regions) c[r]++;
    return c;
  }, [news]);

  const stats = useMemo(() => {
    const now = Date.now();
    const day = (n: number) => now - n * 86400_000;
    const items = news ?? [];
    return {
      today: items.filter((n) => Date.parse(n.publishedAt) >= day(1)).length,
      ransomware: items.filter((n) => Date.parse(n.publishedAt) >= day(7) && n.attackTypes.includes("랜섬웨어")).length,
      kevWeek: (vulns?.kev ?? []).filter((k) => Date.parse(k.dateAdded) >= day(7)).length,
      critical: (vulns?.cves ?? []).filter((c) => (c.cvss ?? 0) >= 9).length,
    };
  }, [news, vulns]);

  const regionItems = useMemo(
    () => (news ?? []).filter((n) => tab === "all" || tab === "vuln" || n.regions.includes(tab)),
    [news, tab],
  );

  const failedSources = meta?.sources.filter((x) => !x.ok) ?? [];

  const goCve = (cve: string) => {
    setVulnQuery(cve);
    setTab("vuln");
    window.scrollTo({ top: 0 });
  };
  const goNews = (q: string) => {
    setFilters({ ...EMPTY_FILTERS, q });
    setTab("all");
    window.scrollTo({ top: 0 });
  };

  return (
    // FluentProvider의 className은 툴팁·팝오버 포털에도 복사된다. 배경·높이 같은 레이아웃 스타일을
    // 여기에 두면 포털마다 화면을 덮는 불투명한 판이 생기므로 반드시 안쪽 div에 둔다.
    <FluentProvider theme={dark ? darkTheme : lightTheme}>
      <div className={s.page}>
        <div className={s.shell}>
          <header className={s.header}>
            <div>
              <Title2 as="h1">Security Glance</Title2>
              <Caption1 className={s.subtitle}>국제 · 일본 · 한국 보안 이슈를 한눈에. 요약과 태그는 AI가 만들었어요.</Caption1>
            </div>
            {meta?.updatedAt && (
              <Popover withArrow>
                <PopoverTrigger disableButtonEnhancement>
                  <Button appearance="subtle" size="small" icon={<InfoRegular />}>
                    <span className={s.updated}>
                      {relativeTime(meta.updatedAt)} 갱신
                      {failedSources.length > 0 && <CounterBadge count={failedSources.length} color="danger" size="small" />}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverSurface aria-label="수집 상태">
                  <div className={s.sources}>
                    <Body1>
                      <b>마지막 수집</b> {fullDateTime(meta.updatedAt)}
                    </Body1>
                    {meta.sources.map((src) => (
                      <div key={src.id} className={s.sourceRow}>
                        {src.ok ? <CheckmarkCircleRegular className={s.ok} /> : <DismissCircleRegular className={s.bad} />}
                        <Caption1>
                          [{REGION_LABEL[src.region]}] {src.name} {src.ok ? `· ${src.items}건` : `· ${src.error ?? "실패"}`}
                        </Caption1>
                      </div>
                    ))}
                  </div>
                </PopoverSurface>
              </Popover>
            )}
          </header>

          <div className={s.stats}>
            <div className={s.stat}>
              <Caption1 className={s.statLabel}>최근 24시간 기사</Caption1>
              <Subtitle1>{stats.today}</Subtitle1>
            </div>
            <div className={s.stat}>
              <Caption1 className={s.statLabel}>이번 주 랜섬웨어 기사</Caption1>
              <Subtitle1>{stats.ransomware}</Subtitle1>
            </div>
            <div className={s.stat}>
              <Caption1 className={s.statLabel}>이번 주 KEV 추가</Caption1>
              <Subtitle1>{stats.kevWeek}</Subtitle1>
            </div>
            <div className={s.stat}>
              <Caption1 className={s.statLabel}>CVSS 9.0+ 신규 (14일)</Caption1>
              <Subtitle1>{stats.critical}</Subtitle1>
            </div>
          </div>

          <div className={s.tabs}>
            <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as TabKey)}>
              <Tab value="all">전체 {news ? `(${news.length})` : ""}</Tab>
              {REGIONS.map((r) => (
                <Tab key={r} value={r}>
                  {REGION_LABEL[r]} {news ? `(${counts[r]})` : ""}
                </Tab>
              ))}
              <Tab value="vuln">취약점</Tab>
            </TabList>
          </div>

          {failedSources.length > 0 && tab !== "vuln" && (
            <MessageBar intent="warning" style={{ marginBottom: 12 }}>
              <MessageBarBody>
                이번 수집에서 {failedSources.map((x) => x.name).join(", ")} 소스를 읽지 못했어요. 다음 수집 때 다시 시도해요.
              </MessageBarBody>
            </MessageBar>
          )}

          {news === null ? (
            <div className={s.center}>
              <Spinner label="불러오는 중" />
            </div>
          ) : tab === "vuln" ? (
            <VulnView data={vulns} news={news} query={vulnQuery} setQuery={setVulnQuery} onNews={goNews} />
          ) : news.length === 0 ? (
            <div className={s.center}>
              <Text>아직 수집된 기사가 없어요. 첫 수집이 끝나면 여기에 나타나요.</Text>
            </div>
          ) : (
            <NewsView
              items={regionItems}
              filters={filters}
              setFilters={setFilters}
              epss={vulns?.mentioned ?? {}}
              onCve={goCve}
            />
          )}

          <Caption1 className={s.footer}>
            기사 저작권은 각 언론사와 기관에 있어요. 이 사이트는 제목, 링크, AI 요약만 보여줘요. 요약에는 오류가 있을 수 있으니 중요한
            내용은 원문을 확인하세요. 취약점 데이터: CISA KEV, NVD, FIRST EPSS.
          </Caption1>
        </div>
      </div>
    </FluentProvider>
  );
}
