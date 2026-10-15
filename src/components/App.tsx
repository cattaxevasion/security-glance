// 앱 셸: 상단 앱 바 + 왼쪽 탐색 + 본문 + 오른쪽 상세 패널 (Microsoft Defender 포털 구조)
import {
  FluentProvider,
  Button,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Skeleton,
  SkeletonItem,
  Toast,
  ToastTitle,
  Toaster,
  makeStyles,
  tokens,
  useId,
  useToastController,
  webDarkTheme,
  webLightTheme,
  type Theme,
} from "@fluentui/react-components";
import { CheckmarkCircleFilled } from "@fluentui/react-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "pretendard-jp/dist/web/variable/pretendardvariable-jp-dynamic-subset.css";
import type { Region } from "../../shared/taxonomy";
import type { ArticleRef, Briefing, Meta, Topic, VulnData } from "../../shared/types";
import { FONT_STACK, REGION_LABELS, STRINGS, detectLang, saveLang, type Lang } from "../i18n";
import { AppHeader } from "./AppHeader";
import { AppNav, VIEWS, type View } from "./AppNav";
import { DetailPanel, type Selection } from "./DetailPanel";
import { useMediaQuery, useNarrow, usePrefersDark } from "./hooks";
import { BriefingPage } from "./BriefingPage";
import { IncidentsPage } from "./IncidentsPage";
import { useMotion } from "./motion";
import { DEFAULT_FILTERS, TopicsPage, type NewsFilters, type SortMode } from "./TopicsPage";
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
  // 본문은 한 단계 어두운 캔버스, 내용은 그 위의 흰 카드 (Microsoft 365의 층 구조)
  main: { flex: 1, minWidth: 0, overflowY: "auto", backgroundColor: tokens.colorNeutralBackground3 },
  center: { display: "flex", justifyContent: "center", padding: "96px 0" },
  skeleton: { display: "flex", flexDirection: "column", gap: "12px", padding: "32px", maxWidth: "1040px" },
  skTitle: { width: "220px", height: "32px", marginBottom: "16px" },
  skRow: { display: "grid", gridTemplateColumns: "48px 1fr", gap: "16px", padding: "12px 0" },
  skLines: { display: "flex", flexDirection: "column", gap: "8px" },
  toastIcon: { color: tokens.colorPaletteGreenForeground1 },
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
  sort: SortMode;
  q: string;
  filters: NewsFilters;
  sel: string | null;
  lang: Lang | null;
}

function readUrl(): UrlState {
  const p = new URLSearchParams(location.search);
  // 처음 열면 오늘의 브리핑부터
  const view = (VIEWS as string[]).includes(p.get("view") ?? "") ? (p.get("view") as View) : "briefing";
  const list = (k: string) => (p.get(k) ? p.get(k)!.split(",").filter(Boolean) : []);
  const days = p.get("days");
  const lang = p.get("lang");
  return {
    view,
    sort: p.get("sort") === "important" ? "important" : "latest",
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

function writeUrl(
  st: { view: View; sort: SortMode; q: string; filters: NewsFilters; sel: string | null; lang: Lang },
  mode: "push" | "replace",
) {
  const p = new URLSearchParams();
  if (st.view !== "briefing") p.set("view", st.view);
  if (st.q) p.set("q", st.q);
  if (isTopicView(st.view)) {
    if (st.sort !== "latest") p.set("sort", st.sort);
    if (st.filters.days !== DEFAULT_FILTERS.days) p.set("days", String(st.filters.days));
    if (st.filters.attack.length) p.set("attack", st.filters.attack.join(","));
    if (st.filters.sector.length) p.set("sector", st.filters.sector.join(","));
    if (st.filters.nature.length) p.set("nature", st.filters.nature.join(","));
  }
  if (st.sel) p.set("sel", st.sel);
  p.set("lang", st.lang);
  const url = `?${p.toString()}`;
  if (url === location.search) return;
  if (mode === "push") history.pushState(null, "", url);
  else history.replaceState(null, "", url);
}

const isVulnView = (v: View): v is "kev" | "cve" => v === "kev" || v === "cve";
const isTopicView = (v: View) => v === "all" || v === "INTL" || v === "JP";

/** 데이터를 불러오는 동안 보여줄 뼈대 (스피너 대신 실제 화면 모양으로) */
function LoadingSkeleton() {
  const s = useStyles();
  return (
    <Skeleton className={s.skeleton} aria-label="loading">
      <SkeletonItem className={s.skTitle} />
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className={s.skRow}>
          <SkeletonItem size={16} />
          <div className={s.skLines}>
            <SkeletonItem size={20} style={{ width: `${70 + ((i * 13) % 25)}%` }} />
            <SkeletonItem size={12} />
            <SkeletonItem size={12} style={{ width: "40%" }} />
          </div>
        </div>
      ))}
    </Skeleton>
  );
}

const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

export default function App() {
  const s = useStyles();
  const m = useMotion();
  const toasterId = useId("toaster");
  const { dispatchToast } = useToastController(toasterId);
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
  const [sort, setSort] = useState<SortMode>(initial.sort);
  const [selection, setSelection] = useState<Selection | null>(
    initial.sel ? { kind: isVulnView(initial.view) ? initial.view : "topic", id: initial.sel } : null,
  );
  const [order, setOrder] = useState<string[]>([]);
  const [navOpen, setNavOpen] = useState(!narrow);

  // 기사 목록은 상세 패널의 '흐름'에만 필요해서 첫 화면이 뜬 뒤에 불러온다
  const [articles, setArticles] = useState<ArticleRef[] | null>(null);
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [vulns, setVulns] = useState<VulnData | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);

  const t = STRINGS[lang];

  const reload = useCallback(() => {
    setLoadError(false);
    load<Topic[]>("topics.json").then((d) => {
      if (d === null) setLoadError(true);
      setTopics(d ?? []);
    });
    load<Briefing[]>("briefings.json").then((d) => setBriefings(d ?? []));
    load<VulnData>("vulns.json").then(setVulns);
    load<Meta>("meta.json").then(setMeta);
  }, []);
  useEffect(reload, [reload]);

  const articlesRequested = useRef(false);
  const loadArticles = useCallback(() => {
    if (articlesRequested.current) return;
    articlesRequested.current = true;
    load<ArticleRef[]>("articles.json").then((d) => setArticles(d ?? []));
  }, []);
  // 상세 패널을 열면 바로, 아니면 첫 화면이 뜨고 잠시 뒤에 미리 불러둔다
  useEffect(() => {
    if (selection?.kind === "topic") loadArticles();
  }, [selection, loadArticles]);
  useEffect(() => {
    if (!topics) return;
    const timer = window.setTimeout(loadArticles, 1500);
    return () => window.clearTimeout(timer);
  }, [topics, loadArticles]);

  useEffect(() => setNavOpen(!narrow), [narrow]);

  useEffect(() => {
    document.documentElement.lang = lang;
    // 한국어는 어절 단위로 줄바꿈해야 읽기 쉽다. 일본어는 띄어쓰기가 없어 기본 규칙(+금칙 처리)을 쓴다.
    // 상세 패널·메뉴는 포털로 앱 밖에 그려지므로 <html>에 걸어 상속시킨다.
    document.documentElement.style.wordBreak = lang === "ko" ? "keep-all" : "normal";
    document.documentElement.style.setProperty("line-break", lang === "ja" ? "strict" : "auto");
    document.title = STRINGS[lang].docTitle;
  }, [lang]);

  const query = isVulnView(view) ? vulnQuery : newsQuery;

  // ── 방문 기록 (뒤로 가기) ──
  // 화면 이동과 '패널 열기'는 기록에 남기고(push), 검색·필터·패널 안에서 다음 항목 넘기기는 덮어쓴다(replace).
  // 그래서 뒤로 가기 한 번이면 패널이 닫히고, 한 번 더 누르면 이전 화면으로 간다.
  const fromPop = useRef(false);
  const panelPushed = useRef(false);
  const prevNav = useRef<{ view: View; sel: string | null }>({ view, sel: selection?.id ?? null });
  useEffect(() => {
    const sel = selection?.id ?? null;
    const prev = prevNav.current;
    let mode: "push" | "replace" = "replace";
    if (fromPop.current) {
      fromPop.current = false;
    } else if (prev.view !== view) {
      mode = "push";
      panelPushed.current = false;
    } else if (prev.sel === null && sel !== null) {
      mode = "push";
      panelPushed.current = true;
    }
    if (sel === null) panelPushed.current = false;
    writeUrl({ view, sort, q: query, filters, sel, lang }, mode);
    prevNav.current = { view, sel };
  }, [view, sort, query, filters, selection, lang]);

  useEffect(() => {
    const onPop = () => {
      const u = readUrl();
      fromPop.current = true;
      panelPushed.current = false;
      setViewState(u.view);
      setSelection(u.sel ? { kind: isVulnView(u.view) ? u.view : "topic", id: u.sel } : null);
      setFilters(u.filters);
      setSort(u.sort);
      if (isVulnView(u.view)) setVulnQuery(u.q);
      else setNewsQuery(u.q);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /** 패널 닫기: 패널을 열 때 기록을 남겼으면 기록도 한 칸 되돌린다 (뒤로 가기와 같은 결과) */
  const closePanel = useCallback(() => {
    if (panelPushed.current) history.back();
    else setSelection(null);
  }, []);
  const select = useCallback(
    (sel: Selection | null) => (sel === null ? closePanel() : setSelection(sel)),
    [closePanel],
  );

  // 브리핑 화면에서 검색하면 토픽 전체로 넘어간다
  const setTopicQuery = (q: string) => {
    if (view === "briefing") setViewState("all");
    setNewsQuery(q);
  };

  const notifyCopied = () =>
    dispatchToast(
      <Toast>
        <ToastTitle media={<CheckmarkCircleFilled className={s.toastIcon} />}>{STRINGS[lang].linkCopied}</ToastTitle>
      </Toast>,
      { intent: "success", timeout: 2000, position: "bottom" },
    );

  // 키보드 단축키: / 검색, j·k 이전·다음 항목, Esc 닫기 (Outlook·Gmail과 같은 감각)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape") {
        if (selection) closePanel();
        return;
      }
      if (isEditable(e.target)) return;
      if (e.key === "/") {
        const input = document.querySelector<HTMLInputElement>("header input, main input[type='search']");
        if (input) {
          e.preventDefault();
          input.focus();
        }
        return;
      }
      if (e.key === "j" || e.key === "k") {
        if (order.length === 0) return;
        const i = selection ? order.indexOf(selection.id) : -1;
        const next = e.key === "j" ? Math.min(order.length - 1, i + 1) : Math.max(0, i - 1);
        const kind = isVulnView(view) ? view : "topic";
        setSelection({ kind, id: order[i < 0 ? 0 : next] });
        // 고른 항목이 보이게 스크롤
        requestAnimationFrame(() =>
          document
            .querySelector("[aria-current='true'], tr[aria-selected='true']")
            ?.scrollIntoView({ block: "nearest" }),
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, order, view]);

  /** 위협 그룹 이름 등으로 토픽 전체를 검색 (기간 제한 없이) */
  const searchAll = (q: string) => {
    setSelection(null);
    setViewState("all");
    setFilters({ ...DEFAULT_FILTERS, days: 0 });
    setNewsQuery(q);
  };

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
    const c: Record<View, number | null> = {
      briefing: null,
      incidents: null,
      all: null,
      INTL: null,
      JP: null,
      kev: null,
      cve: null,
    };
    if (topics) {
      c.all = topics.length;
      const week = Date.now() - 7 * 86400_000;
      c.incidents = topics.filter((n) => n.nature === "사건" && Date.parse(n.firstSeen) >= week).length;
      for (const r of ["INTL", "JP"] as Region[]) c[r] = topics.filter((n) => n.regions.includes(r)).length;
    }
    if (vulns) {
      c.kev = vulns.kev.length;
      c.cve = vulns.cves.length;
    }
    return c;
  }, [topics, vulns]);

  const regionItems = useMemo(
    () => (topics ?? []).filter((n) => view === "all" || !isTopicView(view) || n.regions.includes(view as Region)),
    [topics, view],
  );

  const failed = meta?.sources.filter((x) => !x.ok) ?? [];
  const pageTitle = view === "all" ? t.navAll : view === "INTL" || view === "JP" ? REGION_LABELS[lang][view] : "";

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
          setQuery={isVulnView(view) ? setVulnQuery : setTopicQuery}
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
            {failed.length > 0 && isTopicView(view) && (
              <MessageBar intent="warning" className={s.bar}>
                <MessageBarBody>{t.sourcesFailed(failed.map((x) => x.name).join(", "))}</MessageBarBody>
              </MessageBar>
            )}
            {loadError && (
              <MessageBar intent="error" className={s.bar}>
                <MessageBarBody>{t.loadFailed}</MessageBarBody>
                <MessageBarActions>
                  <Button size="small" onClick={reload}>
                    {t.retry}
                  </Button>
                </MessageBarActions>
              </MessageBar>
            )}
            {topics === null ? (
              <LoadingSkeleton />
            ) : (
              <div key={view} className={m.fade}>
                {view === "briefing" ? (
                  <BriefingPage
                    lang={lang}
                    narrow={narrow}
                    briefings={briefings}
                    topics={topics}
                    vulns={vulns}
                    onOpen={(id) => setSelection({ kind: "topic", id })}
                    onVuln={(id) => setSelection({ kind: "kev", id })}
                    onSearch={searchAll}
                    onGo={setView}
                    onOrder={setOrder}
                  />
                ) : view === "incidents" ? (
                  <IncidentsPage
                    lang={lang}
                    topics={topics}
                    query={newsQuery}
                    setQuery={setNewsQuery}
                    narrow={narrow}
                    selectedId={selection?.kind === "topic" ? selection.id : null}
                    onSelect={(id) => setSelection({ kind: "topic", id })}
                    onOrder={setOrder}
                  />
                ) : isVulnView(view) ? (
                  <VulnPage
                    lang={lang}
                    kind={view}
                    data={vulns}
                    topics={topics}
                    query={vulnQuery}
                    setQuery={setVulnQuery}
                    narrow={narrow}
                    selectedId={selection && selection.kind !== "topic" ? selection.id : null}
                    onSelect={(id) => setSelection({ kind: view, id })}
                    onOrder={setOrder}
                  />
                ) : (
                  <TopicsPage
                    lang={lang}
                    title={pageTitle}
                    showRegion={view === "all"}
                    items={regionItems}
                    vulns={vulns}
                    filters={filters}
                    setFilters={setFilters}
                    sort={sort}
                    setSort={setSort}
                    query={newsQuery}
                    setQuery={setNewsQuery}
                    narrow={narrow}
                    selectedId={selection?.kind === "topic" ? selection.id : null}
                    onSelect={(id) => setSelection({ kind: "topic", id })}
                    onOrder={setOrder}
                    onReload={reload}
                    onCopied={notifyCopied}
                    onGo={setView}
                  />
                )}
              </div>
            )}
          </main>
          <DetailPanel
            lang={lang}
            narrow={narrow}
            inline={wide}
            selection={selection}
            topics={topics ?? []}
            news={articles}
            vulns={vulns}
            order={order}
            onCopied={notifyCopied}
            onSelect={select}
            onSearch={searchAll}
          />
        </div>
      </div>
      <Toaster toasterId={toasterId} />
    </FluentProvider>
  );
}
