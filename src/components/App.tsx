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
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "pretendard-jp/dist/web/variable/pretendardvariable-jp-dynamic-subset.css";
import type { Region } from "../../shared/taxonomy";
import type { ArticleRef, Briefing, CveEntry, LeakPost, Meta, Topic, VulnData } from "../../shared/types";
import { FONT_STACK, REGION_LABELS, STRINGS, detectLang, saveLang, type Lang } from "../i18n";
import { AppHeader } from "./AppHeader";
import { AppNav, VIEWS, type View } from "./AppNav";
import { DetailPanel, type Selection } from "./DetailPanel";
import { useNarrow, usePrefersDark } from "./hooks";
import { BriefingPage } from "./BriefingPage";
import { dayStart, relativeTime } from "./format";
import { setNameReadings, sourceLabel } from "./text";
import { useMotion } from "./motion";
import { DEFAULT_FILTERS, TopicsPage, type NewsFilters, type SortMode } from "./TopicsPage";
import { isFresh, useLastVisit } from "./visit";

// 첫 화면(브리핑)에 필요 없는 화면은 열 때 받는다
const IncidentsPage = lazy(() => import("./IncidentsPage").then((m) => ({ default: m.IncidentsPage })));
const VulnPage = lazy(() => import("./VulnPage").then((m) => ({ default: m.VulnPage })));

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

/** v: 주소 끝에 붙여 CDN 캐시(최대 10분)를 건너뛴다. 열어 둔 화면이 새 데이터를 받을 때 쓴다 */
async function load<T>(name: string, v?: string): Promise<T | null> {
  try {
    const q = v ? `?v=${encodeURIComponent(v)}` : "";
    const res = await fetch(`${import.meta.env.BASE_URL.replace(/\/?$/, "/")}data/${name}${q}`, { cache: "no-cache" });
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

/** 새 기사가 있으면 몇 분 안에 갱신되고, 없어도 전체 실행은 6시간마다 한다. 두 번 연속 빠지면(+GitHub 예약 실행 지연 여유) 데이터가 멈췄다고 알린다. */
const STALE_MS = 13 * 3600_000;

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
  const [leaks, setLeaks] = useState<LeakPost[]>([]);
  const lastVisit = useLastVisit();

  const t = STRINGS[lang];

  // 토픽은 최근 31일치만 먼저 받고, 오래된 것은 첫 화면이 뜬 뒤에 붙인다 (기사를 90일 보관해서 전체는 무겁다)
  const archiveRequested = useRef(false);
  const reload = useCallback(() => {
    setLoadError(false);
    archiveRequested.current = false;
    // 이름 읽기 사전을 먼저 넣어 두고 토픽을 그린다 (한국어 화면에서 일본어 이름을 읽기로 보여주려고)
    Promise.all([load<Topic[]>("topics-recent.json"), load<Record<string, string>>("names-ko.json")]).then(
      ([d, names]) => {
        setNameReadings(names);
        if (d === null) setLoadError(true);
        setTopics(d ?? []);
      },
    );
    load<Briefing[]>("briefings.json").then((d) => setBriefings(d ?? []));
    cvesRequested.current = false;
    load<VulnData>("vulns-core.json").then(setVulns);
    load<Meta>("meta.json").then(setMeta);
    load<LeakPost[]>("leaks.json").then((d) => setLeaks(d ?? []));
  }, []);
  useEffect(reload, [reload]);

  // 고위험 CVE 목록은 CVE 화면이나 CVE 상세를 열 때 바로, 아니면 첫 화면이 뜨고 잠시 뒤에 붙인다
  const cvesRequested = useRef(false);
  const loadCves = useCallback(() => {
    if (cvesRequested.current) return;
    cvesRequested.current = true;
    load<CveEntry[]>("cves.json").then((d) => d && setVulns((v) => (v ? { ...v, cves: d } : v)));
  }, []);
  useEffect(() => {
    if (!vulns) return;
    if (view === "cve" || selection?.kind === "cve") {
      loadCves();
      return;
    }
    const timer = window.setTimeout(loadCves, 3000);
    return () => window.clearTimeout(timer);
  }, [vulns, view, selection, loadCves]);

  const [archiveLoaded, setArchiveLoaded] = useState(false);
  const loadArchive = useCallback(() => {
    if (archiveRequested.current) return;
    archiveRequested.current = true;
    load<Topic[]>("topics-archive.json").then((d) => {
      setArchiveLoaded(true);
      if (!d?.length) return;
      setTopics((prev) => {
        const have = new Set((prev ?? []).map((x) => x.id));
        return [...(prev ?? []), ...d.filter((x) => !have.has(x.id))];
      });
    });
  }, []);
  useEffect(() => {
    if (!topics) return;
    // 링크로 연 토픽이 최근 목록에 없으면 바로, 아니면 잠시 뒤에
    if (selection?.kind === "topic" && !topics.some((x) => x.id === selection.id)) {
      loadArchive();
      return;
    }
    const timer = window.setTimeout(loadArchive, 1500);
    return () => window.clearTimeout(timer);
  }, [topics, selection, loadArchive]);

  // 링크로 연 토픽이 없을 때: 다른 토픽에 합쳐졌으면 그쪽으로, 정말 없으면(보관 기간 지남 등) 안내하고 닫는다
  useEffect(() => {
    if (!topics || !archiveLoaded || selection?.kind !== "topic") return;
    if (topics.some((x) => x.id === selection.id)) return;
    const merged = topics.find((x) => x.aliases?.includes(selection.id));
    if (merged) {
      setSelection({ kind: "topic", id: merged.id });
      return;
    }
    setSelection(null);
    dispatchToast(
      <Toast>
        <ToastTitle>{STRINGS[lang].topicGone}</ToastTitle>
      </Toast>,
      { intent: "info", timeout: 5000, position: "bottom" },
    );
  }, [topics, archiveLoaded, selection]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // 줄바꿈 규칙은 <html lang>을 보고 index.astro의 전역 CSS가 정한다 (포털로 그리는 패널·메뉴도 상속)
    document.documentElement.lang = lang;
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

  // ── 열어 둔 화면도 새 소식을 받는다 ──
  // 1분마다(화면이 보일 때만) 갱신 시각을 보고, 바뀌었으면 화면을 비우지 않고 데이터만 바꿔 끼운다.
  // 이미 받아 둔 지난 토픽·기사·CVE 목록은 그대로 두고, 바뀐 것만 다시 받는다.
  const live = useRef({ updatedAt: "", topics: null as Topic[] | null, lang });
  live.current.topics = topics;
  live.current.lang = lang;
  useEffect(() => {
    if (meta && !live.current.updatedAt) live.current.updatedAt = meta.updatedAt;
  }, [meta]);
  const refresh = useCallback(async () => {
    const m = await load<Meta>("meta.json", String(Date.now()));
    if (!m || !live.current.updatedAt || m.updatedAt === live.current.updatedAt) return;
    live.current.updatedAt = m.updatedAt;
    const v = m.updatedAt;
    const [recent, names, b, core, lk] = await Promise.all([
      load<Topic[]>("topics-recent.json", v),
      load<Record<string, string>>("names-ko.json", v),
      load<Briefing[]>("briefings.json", v),
      load<VulnData>("vulns-core.json", v),
      load<LeakPost[]>("leaks.json", v),
    ]);
    if (!recent) return;
    const [arts, cves] = await Promise.all([
      articlesRequested.current ? load<ArticleRef[]>("articles.json", v) : null,
      cvesRequested.current ? load<CveEntry[]>("cves.json", v) : null,
    ]);
    const prev = live.current.topics ?? [];
    const before = new Set(prev.map((x) => x.id));
    const added = recent.filter((x) => !before.has(x.id)).length;
    // 최근 목록에 없는 지난 토픽(보관분)은 남긴다. 최근 범위 안인데 빠진 것은 합쳐지거나 정리된 것이라 뺀다
    const recentIds = new Set(recent.map((x) => x.id));
    const cut = Date.now() - 31 * 86400_000;
    const kept = prev.filter((x) => !recentIds.has(x.id) && Date.parse(x.lastUpdated) < cut);
    setNameReadings(names);
    setTopics([...recent, ...kept]);
    if (b) setBriefings(b);
    if (core) setVulns((old) => ({ ...core, cves: cves ?? old?.cves ?? core.cves }));
    if (lk) setLeaks(lk);
    if (arts) setArticles(arts);
    setMeta(m);
    if (added > 0)
      dispatchToast(
        <Toast>
          <ToastTitle>{STRINGS[live.current.lang].liveNew(added)}</ToastTitle>
        </Toast>,
        { intent: "info", timeout: 6000, position: "bottom" },
      );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

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
      // 인시던트 화면의 '최근 7일'과 같은 기준 (오늘 포함 달력 7일)
      const week = dayStart(6).getTime();
      c.incidents = topics.filter((n) => n.nature === "사건" && Date.parse(n.firstSeen) >= week).length;
      for (const r of ["INTL", "JP"] as Region[]) c[r] = topics.filter((n) => n.regions.includes(r)).length;
    }
    if (vulns) {
      c.kev = vulns.kev.length;
      c.cve = vulns.cves.length || meta?.cveCount || null;
    }
    return c;
  }, [topics, vulns, meta]);

  // 지난 방문 이후 새 소식 (탐색 메뉴의 +N)
  const fresh = useMemo(() => {
    const out: Partial<Record<View, number>> = {};
    if (!topics || lastVisit == null) return out;
    const xs = topics.filter((x) => isFresh(x, lastVisit));
    out.all = xs.length;
    out.incidents = xs.filter((x) => x.nature === "사건").length;
    for (const r of ["INTL", "JP"] as Region[]) out[r] = xs.filter((x) => x.regions.includes(r)).length;
    return out;
  }, [topics, lastVisit]);

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
          onHome={() => {
            setNewsQuery("");
            setVulnQuery("");
            setView("briefing");
          }}
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
            fresh={fresh}
            dark={dark}
          />
          <main className={s.main}>
            {failed.length > 0 && isTopicView(view) && (
              <MessageBar intent="warning" className={s.bar}>
                <MessageBarBody>{t.sourcesFailed(failed.map((x) => sourceLabel(lang, x.name)).join(", "))}</MessageBarBody>
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
            {meta?.updatedAt && Date.now() - Date.parse(meta.updatedAt) > STALE_MS && (
              <MessageBar intent="warning" className={s.bar}>
                <MessageBarBody>{t.staleData(relativeTime(lang, meta.updatedAt))}</MessageBarBody>
              </MessageBar>
            )}
            {topics === null ? (
              <LoadingSkeleton />
            ) : (
              <div key={view} className={m.fade}>
                <Suspense fallback={<LoadingSkeleton />}>
                {view === "briefing" ? (
                  <BriefingPage
                    lang={lang}
                    narrow={narrow}
                    briefings={briefings}
                    topics={topics}
                    vulns={vulns}
                    leaks={leaks}
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
                    leaks={leaks}
                    lastVisit={lastVisit}
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
                    lastVisit={lastVisit}
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
                </Suspense>
              </div>
            )}
          </main>
          <DetailPanel
            lang={lang}
            narrow={narrow}
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
