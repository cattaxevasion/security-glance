// 랜섬웨어 유출 사이트 게시 (일본). 공격 조직의 주장이라 사실 확인 전 정보임을 늘 함께 보여준다.
import { Badge, Button, Caption1, makeStyles, mergeClasses, Subtitle2, tokens } from "@fluentui/react-components";
import { ChevronDownRegular, ChevronUpRegular, LockClosedKeyRegular } from "@fluentui/react-icons";
import { useState } from "react";
import type { LeakPost } from "../../shared/types";
import { STRINGS, tagLabel, type Lang } from "../i18n";
import { relativeTime, shortDate } from "./format";
import { usePageStyles } from "./page";

const useStyles = makeStyles({
  section: { padding: "16px 20px", margin: "0 0 16px" },
  head: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" },
  icon: {
    width: "32px",
    height: "32px",
    borderRadius: tokens.borderRadiusLarge,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
    flexShrink: 0,
    backgroundColor: tokens.colorPaletteMarigoldBackground1,
    color: tokens.colorPaletteMarigoldForeground2,
  },
  note: { display: "block", color: tokens.colorNeutralForeground3, marginBottom: "10px", maxWidth: "80ch" },
  list: { margin: 0, padding: 0, listStyle: "none" },
  row: {
    display: "grid",
    gridTemplateColumns: "72px 1fr auto",
    alignItems: "center",
    gap: "4px 12px",
    padding: "8px 0",
    borderTop: `1px solid ${tokens.colorNeutralStroke3}`,
    "@media (max-width: 640px)": { gridTemplateColumns: "1fr auto" },
  },
  date: {
    color: tokens.colorNeutralForeground3,
    fontVariantNumeric: "tabular-nums",
    "@media (max-width: 640px)": { display: "none" },
  },
  victim: { minWidth: 0, display: "flex", flexDirection: "column" },
  victimName: {
    fontWeight: tokens.fontWeightSemibold,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  sub: { color: tokens.colorNeutralForeground3 },
  more: { marginTop: "6px" },
});

interface Props {
  lang: Lang;
  leaks: LeakPost[];
  /** 처음에 보여줄 개수 (나머지는 '더 보기') */
  limit: number;
  onOpen: (topicId: string) => void;
  className?: string;
}

export function LeaksSection({ lang, leaks, limit, onOpen, className }: Props) {
  const s = useStyles();
  const ps = usePageStyles();
  const t = STRINGS[lang];
  const [open, setOpen] = useState(false);
  if (!leaks.length) return null;
  const shown = open ? leaks : leaks.slice(0, limit);
  return (
    <section className={mergeClasses(ps.surface, s.section, className)} aria-label={t.leaksTitle}>
      <div className={s.head}>
        <span className={s.icon} aria-hidden>
          <LockClosedKeyRegular />
        </span>
        <Subtitle2>{t.leaksTitle}</Subtitle2>
        <Caption1 className={s.sub}>{t.count(leaks.length)}</Caption1>
      </div>
      <Caption1 className={s.note}>{t.leaksNote}</Caption1>
      <LeakList lang={lang} leaks={shown} onOpen={onOpen} />
      {leaks.length > limit && (
        <Button
          className={s.more}
          size="small"
          appearance="subtle"
          icon={open ? <ChevronUpRegular /> : <ChevronDownRegular />}
          onClick={() => setOpen(!open)}
        >
          {open ? t.showLess : t.showMore(leaks.length - limit)}
        </Button>
      )}
    </section>
  );
}

/** 게시 목록 (브리핑 위젯에서도 쓴다) */
export function LeakList({ lang, leaks, onOpen }: { lang: Lang; leaks: LeakPost[]; onOpen: (id: string) => void }) {
  const s = useStyles();
  const t = STRINGS[lang];
  return (
    <ul className={s.list}>
      {leaks.map((x) => (
        <li key={x.id} className={s.row}>
          <Caption1 className={s.date}>{shortDate(lang, x.discovered)}</Caption1>
          <span className={s.victim}>
            <span className={s.victimName} title={x.website ?? undefined}>
              {x.victim}
            </span>
            <Caption1 className={s.sub}>
              {x.group}
              {x.sector && ` · ${tagLabel(lang, x.sector)}`} · {relativeTime(lang, x.discovered)}
            </Caption1>
          </span>
          {x.topicIds.length ? (
            <Button size="small" appearance="transparent" onClick={() => onOpen(x.topicIds[0])}>
              <Badge appearance="tint" color="brand">
                {t.leaksReported}
              </Badge>
            </Button>
          ) : (
            <Badge appearance="outline" color="informative">
              {t.leaksUnreported}
            </Badge>
          )}
        </li>
      ))}
    </ul>
  );
}
