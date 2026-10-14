// 앱 셸: 상단 앱 바 + 왼쪽 탐색 + 본문 + 오른쪽 상세 패널 (Microsoft Defender 포털 구조)
import {
  FluentProvider,
  MessageBar,
  MessageBarBody,
  Spinner,
  makeStyles,
  tokens,
  webDarkTheme,
  webLightTheme,
  type Theme,
} from "@fluentui/react-components";
import { useCallback, useEffect, useMemo, useState } from "react";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "pretendard-jp/dist/web/variable/pretendardvariable-jp-dynamic-subset.css";
import type { Region } from "../../shared/taxonomy";
import type { Meta, NewsItem, VulnData } from "../../shared/types";
import { FONT_STACK, REGION_LABELS, STRINGS, detectLang, saveLang, type Lang } from "../i18n";
import { AppHeader } from "./AppHeader";
import { AppNav, VIEWS, type View } from "./AppNav";
import { DetailPanel, type Selection } from "./DetailPanel";
import { useMediaQuery, useNarrow, usePrefersDark } from "./hooks";
import { DEFAULT_FILTERS, NewsPage, type NewsFilters } from "./NewsPage";
import { VulnPage } from "./VulnPage";

const useStyles = makeStyles({
  // FluentProvider의 className은 툴팁·팝오버 포털에도 복사된다. 배경·높이 같은 레이아웃 스타일은
  // 반드시 이 안쪽 div에 둔다 (Provider에 두면 포털마다 화면을 덮는 판이 생긴다).
  root: {
    height: "100dvh",
    display: "flex",
    flexDirection: "column",
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
  },
  body: { flex: 1, minHeight: 0, display: "flex" },
  main: { flex: 1, minWidth: 0, overflowY: "auto", backgroundColor: tokens.colorNeutralBackground1 },
  center: { display: "flex", justifyContent: "center", padding: "96px 0" },
  bar: { margin: "16px 32px 0" },
});

function makeTheme(dark: boolean, lang: Lang): Theme {
  return { ...(dark ? webDarkTheme : webLightTheme), fontFamilyBase: FONT_STACK[lang] };
}

async function load<T>(name: string): Promise<T | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL.replace(/\/?$/, "/")}data/${name}`, { cache: "no-cache" });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

// ── 주소창 상태: 보기·검색·필터·선택 항목을 URL에 남겨 북마크·공유할 수 있게 한다 (Defender처럼) ──
interface UrlState {
  view: View;
  q: string;
  filters: NewsFilters;
  sel: string | null;
  lang: Lang | null;
}

function readUrl(): UrlState {
  const p = new URLSearchParams(location.search);
  const view = (VIEWS as string[]).includes(p.get("view") ?? "") ? (p.get("view") as View) : "all";
  const list = (k: string) => (p.get(k) ? p.get(k)!.split(",").filter(Boolean) : []);
  const days = p.get("days");
  const lang = p.get("lang");
  return {
    view,
    q: p.get("q") ?? "",
    filters: {
      attack: list("attack"),
      sector: list("sector"),
      nature: list("nature"),
      days: days != null && !isNaN(Number(days)) ? Number(days) : DEFAULT_FILTERS.days,
    },
    sel: p.get("sel"),
    lang: lang === "ko" || lang === "ja" ? lang : null,
  };
}

function writeUrl(st: { view: View; q: string; filters: NewsFilters; sel: string | null; lang: Lang }) {
  const p = new URLSearchParams();
  if (st.view !== "all") p.set("view", st.view);
  if (st.q) p.set("q", st.q);
  if (st.view !== "kev" && st.view !== "cve") {
    if (st.filters.days !== DEFAULT_FILTERS.days) p.set("days", String(st.filters.days));
    if (st.filters.attack.length) p.set("attack", st.filters.attack.join(","));
    if (st.filters.sector.length) p.set("sector", st.filters.sector.join(","));
    if (st.filters.nature.length) p.set("nature", st.filters.nature.join(","));
  }
  if (st.sel) p.set("sel", st.sel);
  p.set("lang", st.lang);
  history.replaceState(null, "", `?${p.toString()}`);
}

const isVulnView = (v: View): v is "kev" | "cve" => v === "kev" || v === "cve";

export default function App() {
  const s = useStyles();
  const dark = usePrefersDark();
  const narrow = useNarrow();
  // 탐색(260) + 목록(최소 500) + 읽기 창(520)이 나란히 들어가는 폭부터 읽기 창을 옆에 붙인다
  const wide = useMediaQuery("(min-width: 1320px)");
  const initial = useMemo(readUrl, []);

  const [lang, setLangState] = useState<Lang>(() => initial.lang ?? detectLang());
  const [view, setViewState] = useState<View>(initial.view);
  const [newsQuery, setNewsQuery] = useState(isVulnView(initial.view) ? "" : initial.q);
  const [vulnQuery, setVulnQuery] = useState(isVulnView(initial.view) ? initial.q : "");
  const [filters, setFilters] = useState<NewsFilters>(initial.filters);
  const [selection, setSelection] = useState<Selection | null>(
    initial.sel ? { kind: isVulnView(initial.view) ? initial.view : "news", id: initial.sel } : null,
  );
  const [order, setOrder] = useState<string[]>([]);
  const [navOpen, setNavOpen] = useState(!narrow);

  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [vulns, setVulns] = useState<VulnData | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);

  const t = STRINGS[lang];

  const reload = useCallback(() => {
    // 개발 서버에서는 scripts/dev/dev-fixture.ts가 만든 임시 데이터가 있으면 그걸 쓴다
    const devNews = import.meta.env.DEV ? load<NewsItem[]>("news.dev.json") : Promise.resolve(null);
    devNews.then((d) => d ?? load<NewsItem[]>("news.json")).then((d) => setNews(d ?? []));
    load<VulnData>("vulns.json").then(setVulns);
    load<Meta>("meta.json").then(setMeta);
  }, []);
  useEffect(reload, [reload]);

  useEffect(() => setNavOpen(!narrow), [narrow]);

  useEffect(() => {
    document.documentElement.lang = lang;
    // 한국어는 어절 단위로 줄바꿈해야 읽기 쉽다. 일본어는 띄어쓰기가 없어 기본 규칙(+금칙 처리)을 쓴다.
    // 상세 패널·메뉴는 포털로 앱 밖에 그려지므로 <html>에 걸어 상속시킨다.
    document.documentElement.style.wordBreak = lang === "ko" ? "keep-all" : "normal";
    document.documentElement.style.setProperty("line-break", lang === "ja" ? "strict" : "auto");
    document.title = lang === "ja" ? "Security Glance – セキュリティニュース" : "Security Glance – 보안 이슈 한눈에";
  }, [lang]);

  const query = isVulnView(view) ? vulnQuery : newsQuery;
  useEffect(() => writeUrl({ view, q: query, filters, sel: selection?.id ?? null, lang }), [view, query, filters, selection, lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    saveLang(l);
  };

  const setView = (v: View) => {
    setViewState(v);
    setSelection(null);
    document.querySelector("main")?.scrollTo({ top: 0 });
  };

  const counts = useMemo(() => {
    const c: Record<View, number | null> = { all: null, INTL: null, JP: null, KR: null, kev: null, cve: null };
    if (news) {
      c.all = news.length;
      for (const r of ["INTL", "JP", "KR"] as Region[]) c[r] = news.filter((n) => n.regions.includes(r)).length;
    }
    if (vulns) {
      c.kev = vulns.kev.length;
      c.cve = vulns.cves.length;
    }
    return c;
  }, [news, vulns]);

  const regionItems = useMemo(
    () => (news ?? []).filter((n) => view === "all" || isVulnView(view) || n.regions.includes(view)),
    [news, view],
  );

  const failed = meta?.sources.filter((x) => !x.ok) ?? [];
  const pageTitle = view === "all" ? t.navAll : isVulnView(view) ? "" : REGION_LABELS[lang][view];

  return (
    <FluentProvider theme={makeTheme(dark, lang)}>
      <div className={s.root}>
        <AppHeader
          lang={lang}
          setLang={setLang}
          dark={dark}
          narrow={narrow}
          navOpen={navOpen}
          toggleNav={() => setNavOpen(!navOpen)}
          query={query}
          setQuery={isVulnView(view) ? setVulnQuery : setNewsQuery}
          searchPlaceholder={isVulnView(view) ? t.vulnSearch : t.search}
          meta={meta}
        />
        <div className={s.body}>
          <AppNav
            lang={lang}
            view={view}
            setView={setView}
            open={navOpen}
            overlay={narrow}
            onClose={() => setNavOpen(false)}
            counts={counts}
          />
          <main className={s.main}>
            {failed.length > 0 && !isVulnView(view) && (
              <MessageBar intent="warning" className={s.bar}>
                <MessageBarBody>{t.sourcesFailed(failed.map((x) => x.name).join(", "))}</MessageBarBody>
              </MessageBar>
            )}
            {news === null ? (
              <div className={s.center}>
                <Spinner label={t.loading} />
              </div>
            ) : isVulnView(view) ? (
              <VulnPage
                lang={lang}
                kind={view}
                data={vulns}
                news={news}
                query={vulnQuery}
                setQuery={setVulnQuery}
                narrow={narrow}
                selectedId={selection && selection.kind !== "news" ? selection.id : null}
                onSelect={(id) => setSelection({ kind: view, id })}
                onOrder={setOrder}
              />
            ) : (
              <NewsPage
                lang={lang}
                title={pageTitle}
                showRegion={view === "all"}
                items={regionItems}
                vulns={vulns}
                filters={filters}
                setFilters={setFilters}
                query={newsQuery}
                setQuery={setNewsQuery}
                narrow={narrow}
                selectedId={selection?.kind === "news" ? selection.id : null}
                onSelect={(id) => setSelection({ kind: "news", id })}
                onOrder={setOrder}
                onReload={reload}
                onGo={setView}
              />
            )}
          </main>
          <DetailPanel
            lang={lang}
            narrow={narrow}
            inline={wide}
            selection={selection}
            news={news ?? []}
            vulns={vulns}
            order={order}
            onSelect={setSelection}
            onSearch={(q) => {
              setSelection(null);
              setViewState("all");
              setFilters({ ...DEFAULT_FILTERS, days: 0 });
              setNewsQuery(q);
            }}
          />
        </div>
      </div>
    </FluentProvider>
  );
}
