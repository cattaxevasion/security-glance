// 오늘의 브리핑: 아침에 3분 안에 읽는 글. 읽기 폭을 좁게 잡고 번호 매긴 항목으로 보여준다.
import {
  Button,
  Caption1,
  Menu,
  MenuItemRadio,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Subtitle1,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { ArrowRightRegular, ChevronDownRegular, HistoryRegular, LightbulbRegular } from "@fluentui/react-icons";
import { useEffect, useMemo, useState } from "react";
import type { Briefing, Topic } from "../../shared/types";
import { LOCALE, REGION_LABELS, STRINGS, type Lang } from "../i18n";
import { NatureMark } from "./marks";
import { PageTitle, usePageStyles } from "./page";

const useStyles = makeStyles({
  wrap: { maxWidth: "760px" },
  sub: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "8px", marginTop: "4px" },
  muted: { color: tokens.colorNeutralForeground3 },
  headline: {
    margin: "24px 0 8px",
    padding: "16px 20px",
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorNeutralForeground1,
    fontSize: "17px",
    lineHeight: "28px",
    fontWeight: tokens.fontWeightSemibold,
  },
  list: { listStyle: "none", margin: 0, padding: 0, counterReset: "item" },
  item: {
    display: "grid",
    gridTemplateColumns: "32px 1fr",
    gap: "0 12px",
    padding: "24px 0",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  num: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground2,
    fontWeight: tokens.fontWeightSemibold,
    fontVariantNumeric: "tabular-nums",
  },
  meta: { display: "flex", flexWrap: "wrap", gap: "4px 12px", color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
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
});

interface Props {
  lang: Lang;
  briefings: Briefing[];
  topics: Topic[];
  onOpen: (topicId: string) => void;
  onOrder: (ids: string[]) => void;
}

export function BriefingPage({ lang, briefings, topics, onOpen, onOrder }: Props) {
  const s = useStyles();
  const ps = usePageStyles();
  const t = STRINGS[lang];
  const [date, setDate] = useState<string | null>(null);
  const b = briefings.find((x) => x.date === date) ?? briefings[0];
  const byId = useMemo(() => new Map(topics.map((x) => [x.id, x])), [topics]);

  const ids = useMemo(() => (b ? b.items.map((i) => i.topicId).filter((id) => byId.has(id)) : []), [b, byId]);
  useEffect(() => onOrder(ids), [ids]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmtDate = (d: string) =>
    new Intl.DateTimeFormat(LOCALE[lang], { month: "long", day: "numeric", weekday: "short" }).format(new Date(`${d}T00:00:00+09:00`));

  return (
    <div className={`${ps.page} ${s.wrap}`}>
      <PageTitle>{t.briefingTitle}</PageTitle>
      <div className={s.sub}>
        <Text className={s.muted}>{b ? fmtDate(b.date) : t.briefingSub}</Text>
        {briefings.length > 1 && (
          <Menu checkedValues={{ date: [b?.date ?? ""] }} onCheckedValueChange={(_, d) => setDate(d.checkedItems[0])}>
            <MenuTrigger disableButtonEnhancement>
              <Button appearance="subtle" icon={<HistoryRegular />}>
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

      {!b ? (
        <div className={ps.empty}>
          <Subtitle1>{t.briefingEmpty}</Subtitle1>
          <Text>{t.briefingSub}</Text>
        </div>
      ) : (
        <>
          <p className={s.headline}>{lang === "ja" ? b.headlineJa : b.headlineKo}</p>
          <ol className={s.list}>
            {b.items.map((it, i) => {
              const topic = byId.get(it.topicId);
              return (
                <li key={it.topicId} className={s.item}>
                  <span className={s.num} aria-hidden>
                    {i + 1}
                  </span>
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
                        onClick={() => onOpen(topic.id)}
                      >
                        {t.briefingMore}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          <Caption1 className={ps.footer}>{t.aiNotice}</Caption1>
        </>
      )}
    </div>
  );
}
