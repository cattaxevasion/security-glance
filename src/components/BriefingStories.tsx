// 모바일 브리핑: 인스타그램 스토리처럼 카드가 자동으로 넘어간다.
// - 위쪽 진행 막대가 차면 다음 카드로 (CSS 애니메이션의 끝 = 넘김 신호)
// - 화면 왼쪽 1/3 탭은 이전, 나머지는 다음 / 꾹 누르면 멈춤 / 옆으로 밀어 넘기기
// - 동작 줄이기 설정이면 자동 넘김 없이 시작 (탭과 밀기로만)
import { Button, makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import {
  ArrowClockwiseRegular,
  ArrowRightRegular,
  LightbulbRegular,
  PauseRegular,
  PlayRegular,
  SparkleFilled,
} from "@fluentui/react-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Briefing, Topic } from "../../shared/types";
import { REGION_LABELS, STRINGS, tagLabel, type Lang } from "../i18n";
import { NATURE_ICON, natureGradient } from "./marks";
import { pendingEn, textOf } from "./text";
import { nb } from "./NoBreak";

const COVER_MS = 5000;
const ITEM_MS = 9000;

// 카드 배경: 흰 글자가 충분히 읽히는 짙은 그라디언트. 성격마다 색 계열을 바꿔 넘길 때 리듬이 생긴다.
const COVER_BG =
  "radial-gradient(500px 260px at 100% 0%, rgba(160,110,240,.6), transparent 60%), radial-gradient(420px 260px at 0% 100%, rgba(40,140,240,.55), transparent 60%), linear-gradient(150deg, #0c3b5e 0%, #0f548c 45%, #4a3a9c 100%)";

const useStyles = makeStyles({
  frame: {
    position: "relative",
    height: "min(72vh, 580px)",
    minHeight: "440px",
    borderRadius: "18px",
    overflow: "hidden",
    color: "#fff",
    boxShadow: tokens.shadow16,
    // 휴대폰: 모서리·그림자 없이 화면 폭 전체 (속보 띠와 한 덩어리)
    "@media (max-width: 640px)": { margin: "0 -16px", borderRadius: 0, boxShadow: "none" },
    userSelect: "none",
    WebkitUserSelect: "none",
    touchAction: "pan-y",
    WebkitTapHighlightColor: "transparent",
  },
  bg: {
    position: "absolute",
    inset: 0,
    transitionProperty: "opacity",
    transitionDuration: tokens.durationSlow,
  },
  deco: { position: "absolute", right: "-30px", bottom: "-30px", fontSize: "220px", color: "rgba(255,255,255,0.07)" },
  inner: {
    position: "relative",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    padding: "14px 18px 18px",
    boxSizing: "border-box",
  },
  bars: { display: "flex", gap: "4px" },
  bar: { flex: 1, height: "3px", borderRadius: "2px", backgroundColor: "rgba(255,255,255,0.32)", overflow: "hidden" },
  fill: { display: "block", height: "100%", backgroundColor: "#fff", borderRadius: "2px" },
  run: {
    animationName: { from: { width: "0%" }, to: { width: "100%" } },
    animationTimingFunction: "linear",
    animationFillMode: "forwards",
  },
  top: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "10px", minHeight: "32px" },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    height: "24px",
    padding: "0 10px",
    borderRadius: "12px",
    backgroundColor: "rgba(255,255,255,0.18)",
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
  },
  pos: { fontSize: tokens.fontSizeBase200, color: "rgba(255,255,255,0.85)", fontVariantNumeric: "tabular-nums" },
  iconBtn: {
    color: "#fff",
    minWidth: "32px",
    ":hover": { color: "#fff", backgroundColor: "rgba(255,255,255,0.15)" },
    ":hover:active": { color: "#fff", backgroundColor: "rgba(255,255,255,0.25)" },
  },
  content: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    // safe center: 글이 카드보다 길면 위에서부터 (그냥 center는 위쪽이 잘려 스크롤로도 볼 수 없다). 모르는 브라우저는 center
    justifyContent: ["center", "safe center"],
    gap: "12px",
    overflowY: "auto",
    animationName: { from: { opacity: 0, transform: "translateX(16px)" }, to: { opacity: 1, transform: "none" } },
    animationDuration: tokens.durationGentle,
    animationTimingFunction: tokens.curveDecelerateMid,
    animationFillMode: "both",
    "@media (prefers-reduced-motion: reduce)": { animationName: "none" },
  },
  natureRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: tokens.fontSizeBase200,
    color: "rgba(255,255,255,0.88)",
  },
  natureIcon: {
    width: "28px",
    height: "28px",
    borderRadius: "8px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    fontSize: "16px",
  },
  coverDate: { fontSize: tokens.fontSizeBase300, color: "rgba(255,255,255,0.85)" },
  coverTitle: { margin: 0, fontSize: "30px", lineHeight: "38px", fontWeight: tokens.fontWeightBold },
  coverText: { margin: 0, fontSize: "18px", lineHeight: "30px", fontWeight: tokens.fontWeightSemibold },
  title: { margin: 0, fontSize: "22px", lineHeight: "31px", fontWeight: tokens.fontWeightBold },
  body: { margin: 0, fontSize: "15px", lineHeight: "25px", color: "rgba(255,255,255,0.95)" },
  // 영어는 같은 내용이 한국어·일본어보다 길어서 카드에 들어가게 한 단계 작게
  titleEn: { fontSize: "20px", lineHeight: "27px" },
  bodyEn: { fontSize: "14px", lineHeight: "22px" },
  whyEn: { fontSize: tokens.fontSizeBase200, lineHeight: "19px" },
  why: {
    display: "flex",
    gap: "8px",
    alignItems: "flex-start",
    padding: "10px 12px",
    borderRadius: "12px",
    backgroundColor: "rgba(0,0,0,0.22)",
    fontSize: tokens.fontSizeBase300,
    lineHeight: "22px",
  },
  whyLabel: { fontWeight: tokens.fontWeightSemibold, marginRight: "6px" },
  bottom: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginTop: "12px" },
  moreBtn: {
    backgroundColor: "#fff",
    color: "#242424",
    borderTopColor: "#fff",
    borderRightColor: "#fff",
    borderBottomColor: "#fff",
    borderLeftColor: "#fff",
    ":hover": { backgroundColor: "#f0f0f0", color: "#242424" },
    ":hover:active": { backgroundColor: "#e0e0e0", color: "#242424" },
  },
  hint: { fontSize: tokens.fontSizeBase200, color: "rgba(255,255,255,0.85)" },
  replay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
});

type Slide = { kind: "cover" } | { kind: "item"; n: number; item: Briefing["items"][number]; topic?: Topic };

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

interface Props {
  lang: Lang;
  briefing: Briefing;
  topics: Map<string, Topic>;
  dateLabel: string;
  onOpen: (topicId: string) => void;
}

export function BriefingStories({ lang, briefing, topics, dateLabel, onOpen }: Props) {
  const s = useStyles();
  const t = STRINGS[lang];
  const slides: Slide[] = useMemo(
    () => [
      { kind: "cover" },
      ...briefing.items.map((item, i) => ({ kind: "item" as const, n: i + 1, item, topic: topics.get(item.topicId) })),
    ],
    [briefing, topics],
  );

  const [idx, setIdx] = useState(0);
  const [userPaused, setUserPaused] = useState(prefersReducedMotion);
  const [holding, setHolding] = useState(false);
  const [ended, setEnded] = useState(false);
  const paused = userPaused || holding || ended;

  // 브리핑 날짜가 바뀌면 처음부터
  useEffect(() => {
    setIdx(0);
    setEnded(false);
  }, [briefing.date]);

  const next = useCallback(() => {
    if (idx >= slides.length - 1) setEnded(true);
    else setIdx(idx + 1);
  }, [idx, slides.length]);
  const prev = useCallback(() => {
    setEnded(false);
    setIdx((i) => Math.max(0, i - 1));
  }, []);

  // ── 탭·꾹 누르기·밀기 ──
  const press = useRef<{ x: number; y: number; t: number; hold: number } | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, a")) return;
    const hold = window.setTimeout(() => setHolding(true), 220);
    press.current = { x: e.clientX, y: e.clientY, t: Date.now(), hold };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    window.clearTimeout(p.hold);
    if (holding) {
      setHolding(false);
      return;
    }
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) next();
      else prev();
      return;
    }
    if (Math.abs(dy) > 12) return; // 세로 스크롤은 넘김으로 보지 않는다
    const rect = frame.current?.getBoundingClientRect();
    if (rect && e.clientX - rect.left < rect.width / 3) prev();
    else next();
  };
  const onPointerCancel = () => {
    if (press.current) window.clearTimeout(press.current.hold);
    press.current = null;
    setHolding(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") next();
    else if (e.key === "ArrowLeft") prev();
    else if (e.key === " ") {
      e.preventDefault();
      setUserPaused((v) => !v);
    }
  };

  const slide = slides[idx];
  const duration = slide.kind === "cover" ? COVER_MS : ITEM_MS;
  const bg = slide.kind === "cover" ? COVER_BG : natureGradient(slide.topic?.nature ?? "사건");
  const Deco = slide.kind === "item" && slide.topic ? NATURE_ICON[slide.topic.nature] : SparkleFilled;

  return (
    <div
      ref={frame}
      className={s.frame}
      role="region"
      aria-roledescription="carousel"
      aria-label={t.storyLabel}
      tabIndex={0}
      onKeyDown={onKey}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerCancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className={s.bg} style={{ backgroundImage: bg }} aria-hidden />
      <Deco className={s.deco} aria-hidden />

      <div className={s.inner}>
        {/* 진행 막대 */}
        <div className={s.bars} aria-hidden>
          {slides.map((_, i) => (
            <span key={i} className={s.bar}>
              {i < idx || (i === idx && ended) ? (
                <span className={s.fill} style={{ width: "100%" }} />
              ) : i === idx ? (
                <span
                  key={`${briefing.date}-${idx}`}
                  className={mergeClasses(s.fill, s.run)}
                  style={{ animationDuration: `${duration}ms`, animationPlayState: paused ? "paused" : "running" }}
                  onAnimationEnd={next}
                />
              ) : null}
            </span>
          ))}
        </div>

        <div className={s.top}>
          {slide.kind === "cover" ? (
            <span className={s.chip}>
              <SparkleFilled aria-hidden />
              {t.aiGenerated}
            </span>
          ) : (
            <span className={s.pos}>
              {slide.n} / {briefing.items.length}
            </span>
          )}
          <Button
            appearance="transparent"
            className={s.iconBtn}
            icon={userPaused ? <PlayRegular /> : <PauseRegular />}
            aria-label={userPaused ? t.storyPlay : t.storyPause}
            onClick={() => setUserPaused((v) => !v)}
          />
        </div>

        <div key={`${briefing.date}-${idx}`} className={s.content} aria-live={userPaused ? "polite" : "off"}>
          <span
            className="sr-only"
            style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}
          >
            {t.storyPos(idx + 1, slides.length)}
          </span>
          {slide.kind === "cover" ? (
            <>
              <span className={s.coverDate}>{dateLabel}</span>
              <h2 className={s.coverTitle}>{t.briefingTitle}</h2>
              <p className={s.coverText}>{nb(pendingEn(lang, textOf(lang, briefing.headlineKo, briefing.headlineJa, briefing.headlineEn)))}</p>
            </>
          ) : (
            <>
              {slide.topic && (
                <span className={s.natureRow}>
                  <span className={s.natureIcon} aria-hidden>
                    <Deco />
                  </span>
                  {tagLabel(lang, slide.topic.nature)} ·{" "}
                  {slide.topic.regions.map((r) => REGION_LABELS[lang][r]).join(" · ")} ·{" "}
                  {t.sourcesCount(slide.topic.sources.length)}
                </span>
              )}
              <h2 className={mergeClasses(s.title, lang === "en" && s.titleEn)}>{nb(pendingEn(lang, textOf(lang, slide.item.titleKo, slide.item.titleJa, slide.item.titleEn)))}</h2>
              <p className={mergeClasses(s.body, lang === "en" && s.bodyEn)}>{nb(pendingEn(lang, textOf(lang, slide.item.bodyKo, slide.item.bodyJa, slide.item.bodyEn)))}</p>
              <div className={mergeClasses(s.why, lang === "en" && s.whyEn)}>
                <LightbulbRegular style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }} aria-hidden />
                <span>
                  <span className={s.whyLabel}>{t.briefingWhy}</span>
                  {nb(pendingEn(lang, textOf(lang, slide.item.whyKo, slide.item.whyJa, slide.item.whyEn)))}
                </span>
              </div>
            </>
          )}
        </div>

        <div className={s.bottom}>
          <span className={s.hint}>{idx === 0 ? t.storyHint : ""}</span>
          {slide.kind === "item" && slide.topic && (
            <Button
              className={s.moreBtn}
              icon={<ArrowRightRegular />}
              iconPosition="after"
              onClick={() => {
                setUserPaused(true);
                onOpen(slide.topic!.id);
              }}
            >
              {t.briefingMore}
            </Button>
          )}
        </div>
      </div>

      {ended && (
        <div className={s.replay}>
          <Button
            className={s.moreBtn}
            size="large"
            icon={<ArrowClockwiseRegular />}
            onClick={() => {
              setEnded(false);
              setIdx(0);
            }}
          >
            {t.storyReplay}
          </Button>
        </div>
      )}
    </div>
  );
}
