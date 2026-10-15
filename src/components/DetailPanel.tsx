// 오른쪽 상세 패널. 넓은 화면에서는 목록 옆 읽기 창, 좁은 화면에서는 덮는 패널.
// Defender처럼 위·아래 화살표로 목록의 이전·다음 항목으로 이동한다.
import {
  Body1,
  Button,
  Caption1,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  InlineDrawer,
  Link,
  OverlayDrawer,
  Subtitle1,
  Subtitle2,
  Tag,
  Toolbar,
  ToolbarButton,
  Tooltip,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import {
  ArrowDownRegular,
  ArrowUpRegular,
  BugRegular,
  DismissRegular,
  LinkRegular,
  OpenRegular,
  ShieldErrorRegular,
  SparkleRegular,
} from "@fluentui/react-icons";
import { useState, type ReactNode } from "react";
import type { CveEntry, KevEntry, NewsItem, Topic, VulnData } from "../../shared/types";
import { REGION_LABELS, STRINGS, tagLabel, type Lang } from "../i18n";
import { fullDateTime, pct, relativeTime, shortDate } from "./format";
import { EpssMark, NATURE_COLOR, NATURE_ICON, NatureMark } from "./marks";
import { useMotion } from "./motion";
import { namesOf, summaryOf, titleOf } from "./text";
import { PRIORITY_THRESHOLD } from "./TopicsPage";

export type Selection = { kind: "topic"; id: string } | { kind: "kev" | "cve"; id: string };

const useStyles = makeStyles({
  surface: { boxShadow: tokens.shadow64 },
  inline: {
    width: "min(540px, 42vw)",
    height: "100%",
    backgroundColor: tokens.colorNeutralBackground1,
  },
  topBar: { display: "flex", justifyContent: "flex-end", gap: "2px", marginRight: "-8px", marginTop: "-8px" },
  heading: { display: "flex", gap: "16px", alignItems: "flex-start", marginTop: "4px" },
  iconCircle: {
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontSize: "22px",
    backgroundColor: tokens.colorNeutralBackground3,
  },
  headText: { display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 },
  title: { overflowWrap: "anywhere", lineHeight: "28px" },
  metaRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "4px 14px",
    color: tokens.colorNeutralForeground2,
  },
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
  actions: { marginTop: "12px", marginLeft: "-8px" },
  body: { display: "flex", flexDirection: "column", paddingBottom: "16px" },
  section: { padding: "18px 0", borderTop: `1px solid ${tokens.colorNeutralStroke2}` },
  sectionTitle: { display: "block", marginBottom: "12px" },
  summary: {
    margin: 0,
    paddingLeft: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    fontSize: "15px",
    lineHeight: "26px",
    color: tokens.colorNeutralForeground1,
    overflowWrap: "anywhere",
  },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px 24px" },
  field: { display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 },
  full: { gridColumn: "1 / -1" },
  label: { color: tokens.colorNeutralForeground3 },
  value: { lineHeight: "22px", overflowWrap: "anywhere" },
  tags: { display: "flex", flexWrap: "wrap", gap: "6px" },
  technique: { fontFamily: tokens.fontFamilyMonospace, fontWeight: tokens.fontWeightSemibold, marginRight: "6px" },
  // ATT&CK 기법 칩: 누르면 MITRE 페이지로 간다
  techChip: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "24px",
    padding: "2px 8px",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground2,
    fontSize: tokens.fontSizeBase200,
    lineHeight: "18px",
    textDecorationLine: "none",
    ":hover": { backgroundColor: tokens.colorBrandBackground2Hover, textDecorationLine: "underline" },
    ":focus-visible": { outline: `2px solid ${tokens.colorStrokeFocus2}` },
  },
  // 흐름: 세로 선과 점으로 이은 시간순 목록
  timeline: { listStyle: "none", margin: 0, padding: 0, position: "relative" },
  tlItem: {
    position: "relative",
    paddingLeft: "22px",
    paddingBottom: "14px",
    "::before": {
      content: '""',
      position: "absolute",
      left: "5px",
      top: "8px",
      bottom: "-8px",
      width: "2px",
      backgroundColor: tokens.colorNeutralStroke2,
    },
    ":last-child::before": { display: "none" },
  },
  tlDot: {
    position: "absolute",
    left: 0,
    top: "5px",
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    border: `2px solid ${tokens.colorNeutralBackground1}`,
    boxSizing: "border-box",
  },
  tlMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: "2px 10px",
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  tlKind: { fontWeight: tokens.fontWeightSemibold },
  tlTitle: { display: "block", marginTop: "2px", lineHeight: "22px" },
  cveRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "6px 0",
    borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
  },
  mono: { fontFamily: tokens.fontFamilyMonospace },
  notice: {
    display: "flex",
    gap: "6px",
    alignItems: "flex-start",
    color: tokens.colorNeutralForeground3,
    paddingTop: "12px",
  },
  related: { display: "flex", flexDirection: "column", gap: "12px" },
  relatedItem: { display: "flex", flexDirection: "column", gap: "2px" },
  footer: { borderTop: `1px solid ${tokens.colorNeutralStroke2}`, paddingTop: "12px" },
});

const KIND_COLOR: Record<string, string> = {
  vendor: tokens.colorPaletteBerryBackground3,
  cert: tokens.colorPaletteDarkOrangeBackground3,
  news: tokens.colorBrandBackground,
};

type Styles = ReturnType<typeof useStyles>;

function Field({ s, label, children, full }: { s: Styles; label: string; children: ReactNode; full?: boolean }) {
  return (
    <div className={mergeClasses(s.field, full && s.full)}>
      <Caption1 className={s.label}>{label}</Caption1>
      <Body1 className={s.value}>{children}</Body1>
    </div>
  );
}

function Section({ s, title, children }: { s: Styles; title: string; children: ReactNode }) {
  return (
    <section className={s.section}>
      <Subtitle2 className={s.sectionTitle}>{title}</Subtitle2>
      {children}
    </section>
  );
}

interface Props {
  lang: Lang;
  narrow: boolean;
  /** 넓은 화면에서는 목록 옆에 붙는 읽기 창(InlineDrawer)으로 연다 */
  inline: boolean;
  selection: Selection | null;
  topics: Topic[];
  news: NewsItem[];
  vulns: VulnData | null;
  order: string[];
  onCopied: () => void;
  onSelect: (sel: Selection | null) => void;
  onSearch: (q: string) => void;
}

export function DetailPanel(p: Props) {
  const s = useStyles();
  const m = useMotion();
  const t = STRINGS[p.lang];
  const sel = p.selection;
  const [copied, setCopied] = useState(false);

  const idx = sel ? p.order.indexOf(sel.id) : -1;
  const go = (delta: number) => {
    const next = p.order[idx + delta];
    if (sel && next) p.onSelect({ ...sel, id: next });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      p.onCopied();
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // 클립보드 권한이 없으면 조용히 넘어간다
    }
  };

  let content: { head: ReactNode; body: ReactNode; footer: ReactNode } | null = null;
  if (sel?.kind === "topic") {
    const topic = p.topics.find((x) => x.id === sel.id);
    if (topic) content = topicContent(topic, p, s, { copied, copy });
  } else if (sel) {
    const v =
      sel.kind === "kev" ? p.vulns?.kev.find((k) => k.cveID === sel.id) : p.vulns?.cves.find((c) => c.id === sel.id);
    if (v) content = vulnContent(sel.kind, v, p, s);
  }

  const inner = content && (
    <>
      <DrawerHeader>
        <div className={s.topBar}>
          <Tooltip content={t.prevItem} relationship="label">
            <Button appearance="subtle" icon={<ArrowUpRegular />} disabled={idx <= 0} onClick={() => go(-1)} />
          </Tooltip>
          <Tooltip content={t.nextItem} relationship="label">
            <Button
              appearance="subtle"
              icon={<ArrowDownRegular />}
              disabled={idx < 0 || idx >= p.order.length - 1}
              onClick={() => go(1)}
            />
          </Tooltip>
          <Tooltip content={t.close} relationship="label">
            <Button appearance="subtle" icon={<DismissRegular />} onClick={() => p.onSelect(null)} />
          </Tooltip>
        </div>
        {content.head}
      </DrawerHeader>
      {/* 항목이 바뀔 때 내용이 부드럽게 바뀌도록 선택 id로 다시 그린다 */}
      <DrawerBody key={sel?.id} className={mergeClasses(s.body, m.fade)}>
        {content.body}
      </DrawerBody>
      <DrawerFooter className={s.footer}>{content.footer}</DrawerFooter>
    </>
  );

  if (p.inline) {
    return (
      <InlineDrawer className={s.inline} open={!!content} position="end" separator>
        {inner}
      </InlineDrawer>
    );
  }
  return (
    <OverlayDrawer
      className={s.surface}
      open={!!content}
      onOpenChange={(_, d) => !d.open && p.onSelect(null)}
      position="end"
      size={p.narrow ? "full" : "medium"}
      modalType={p.narrow ? "modal" : "non-modal"}
    >
      {inner}
    </OverlayDrawer>
  );
}

/** 대표 출처: 벤더 분석 글이 있으면 그것(가장 자세함), 없으면 최신 기사 */
function representative(articles: NewsItem[]): NewsItem | undefined {
  return articles.find((n) => n.sourceKind === "vendor") ?? articles[0];
}

function topicContent(topic: Topic, p: Props, s: Styles, clip: { copied: boolean; copy: () => void }) {
  const L = p.lang;
  const t = STRINGS[L];
  const Icon = NATURE_ICON[topic.nature];
  const byId = new Map(p.news.map((n) => [n.id, n]));
  const articles = topic.articleIds.map((id) => byId.get(id)).filter((n): n is NewsItem => !!n);
  const main = representative(articles);
  const title = titleOf(L, topic);
  const summary = summaryOf(L, topic);
  const actors = namesOf(L, topic.entities.actors);
  const orgs = namesOf(L, topic.entities.orgs);
  const epss = p.vulns?.mentioned ?? {};
  const articleTitle = (n: NewsItem) => titleOf(L, n, n.title);

  const head = (
    <>
      <div className={s.heading}>
        <span className={s.iconCircle} style={{ color: NATURE_COLOR[topic.nature] }} aria-hidden>
          <Icon />
        </span>
        <div className={s.headText}>
          <Subtitle1 as="h2" className={s.title}>
            {title}
          </Subtitle1>
          <Caption1 className={s.metaRow}>
            {topic.importance >= PRIORITY_THRESHOLD && <span className={s.priority}>{t.priority}</span>}
            <NatureMark nature={topic.nature} lang={L} />
            <span>{topic.regions.map((r) => REGION_LABELS[L][r]).join(" · ")}</span>
            <span>{t.sourcesCount(topic.sources.length)}</span>
            <span>{relativeTime(L, topic.lastUpdated)}</span>
          </Caption1>
        </div>
      </div>
      <Toolbar size="small" className={s.actions}>
        {main && (
          <ToolbarButton as="a" href={main.url} target="_blank" rel="noopener noreferrer" icon={<OpenRegular />}>
            {t.openSource}
          </ToolbarButton>
        )}
        <ToolbarButton icon={<LinkRegular />} onClick={clip.copy}>
          {clip.copied ? t.copied : t.copyLink}
        </ToolbarButton>
      </Toolbar>
    </>
  );

  const tagList = (values: string[]) =>
    values.length ? (
      <div className={s.tags}>
        {values.map((v) => (
          <Tag key={v} size="small" appearance="outline">
            {tagLabel(L, v)}
          </Tag>
        ))}
      </div>
    ) : (
      <span className={s.label}>{t.none}</span>
    );

  const hasAnalysis = topic.techniques.length > 0 || topic.iocTypes.length > 0;

  const body = (
    <>
      <Section s={s} title={t.summary}>
        <ul className={s.summary}>
          {summary.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </Section>

      {hasAnalysis && (
        <Section s={s} title={t.analysis}>
          <div className={s.grid}>
            {topic.techniques.length > 0 && (
              <Field s={s} label={t.techniques} full>
                <div className={s.tags}>
                  {topic.techniques.map((x) => (
                    <a
                      key={x.id}
                      className={s.techChip}
                      href={`https://attack.mitre.org/techniques/${x.id.replace(".", "/")}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className={s.technique}>{x.id}</span>
                      {x.name}
                    </a>
                  ))}
                </div>
              </Field>
            )}
            <Field s={s} label={t.iocTypes} full>
              {topic.iocTypes.length ? tagList(topic.iocTypes) : <span className={s.label}>{t.noIoc}</span>}
            </Field>
          </div>
        </Section>
      )}

      <Section s={s} title={`${t.timeline} · ${t.articles(articles.length)}`}>
        <ol className={s.timeline}>
          {[...articles].reverse().map((n) => (
            <li key={n.id} className={s.tlItem}>
              <span
                className={s.tlDot}
                style={{ backgroundColor: KIND_COLOR[n.sourceKind] ?? KIND_COLOR.news }}
                aria-hidden
              />
              <div className={s.tlMeta}>
                <span>{shortDate(L, n.publishedAt)}</span>
                <span className={s.tlKind}>{n.sourceName}</span>
                <span>{t.kind[n.sourceKind]}</span>
              </div>
              <Link className={s.tlTitle} href={n.url} target="_blank" rel="noopener noreferrer">
                {articleTitle(n)}
              </Link>
            </li>
          ))}
        </ol>
      </Section>

      <Section s={s} title={t.classification}>
        <div className={s.grid}>
          <Field s={s} label={t.attackTypes}>
            {tagList(topic.attackTypes)}
          </Field>
          <Field s={s} label={t.sectors}>
            {tagList(topic.sectors)}
          </Field>
        </div>
      </Section>

      {(topic.entities.cves.length > 0 || actors.length > 0 || orgs.length > 0) && (
        <Section s={s} title={t.entities}>
          <div className={s.grid}>
            {topic.entities.cves.length > 0 && (
              <Field s={s} label={t.cves} full>
                {topic.entities.cves.map((cve) => (
                  <div key={cve} className={s.cveRow}>
                    <Link
                      className={s.mono}
                      onClick={() => {
                        const inKev = p.vulns?.kev.some((k) => k.cveID === cve);
                        const inCve = p.vulns?.cves.some((c) => c.id === cve);
                        if (inKev) p.onSelect({ kind: "kev", id: cve });
                        else if (inCve) p.onSelect({ kind: "cve", id: cve });
                        else window.open(`https://nvd.nist.gov/vuln/detail/${cve}`, "_blank", "noopener");
                      }}
                    >
                      {cve}
                    </Link>
                    <Caption1>
                      <EpssMark
                        epss={epss[cve]?.epss ?? null}
                        percentile={epss[cve]?.percentile ?? null}
                        tip={t.epssTip}
                      />
                    </Caption1>
                  </div>
                ))}
              </Field>
            )}
            {actors.length > 0 && (
              <Field s={s} label={t.actors}>
                <div className={s.tags}>
                  {actors.map((a) => (
                    <Tag key={a} size="small" appearance="brand" as="button" onClick={() => p.onSearch(a)}>
                      {a}
                    </Tag>
                  ))}
                </div>
              </Field>
            )}
            {orgs.length > 0 && (
              <Field s={s} label={t.orgs}>
                {orgs.join(", ")}
              </Field>
            )}
          </div>
        </Section>
      )}

      <Section s={s} title={t.details}>
        <div className={s.grid}>
          <Field s={s} label={t.firstSeen}>
            {fullDateTime(L, topic.firstSeen)}
          </Field>
          <Field s={s} label={t.lastUpdated}>
            {fullDateTime(L, topic.lastUpdated)}
          </Field>
        </div>
        <Caption1 className={s.notice}>
          <SparkleRegular aria-hidden />
          {t.aiNotice}
        </Caption1>
      </Section>
    </>
  );

  const footer = main ? (
    <Button
      appearance="primary"
      as="a"
      href={main.url}
      target="_blank"
      rel="noopener noreferrer"
      icon={<OpenRegular />}
    >
      {t.openSource}
    </Button>
  ) : null;

  return { head, body, footer };
}

function vulnContent(kind: "kev" | "cve", v: KevEntry | CveEntry, p: Props, s: Styles) {
  const L = p.lang;
  const t = STRINGS[L];
  const id = kind === "kev" ? (v as KevEntry).cveID : (v as CveEntry).id;
  const kev = kind === "kev" ? (v as KevEntry) : p.vulns?.kev.find((k) => k.cveID === id);
  const cve = kind === "cve" ? (v as CveEntry) : p.vulns?.cves.find((c) => c.id === id);
  const related = p.topics.filter((x) => x.entities.cves.includes(id));
  const nvd = `https://nvd.nist.gov/vuln/detail/${id}`;

  const head = (
    <div className={s.heading}>
      <span
        className={s.iconCircle}
        style={{ color: kev ? tokens.colorPaletteRedForeground1 : tokens.colorPaletteDarkOrangeForeground1 }}
        aria-hidden
      >
        {kev ? <ShieldErrorRegular /> : <BugRegular />}
      </span>
      <div className={s.headText}>
        <Subtitle1 as="h2" className={mergeClasses(s.title, s.mono)}>
          {id}
        </Subtitle1>
        {kev && <Body1>{kev.vulnerabilityName}</Body1>}
        <Caption1 className={s.metaRow}>
          {kev && <span>{t.inKev}</span>}
          {kev?.ransomware && <span style={{ color: tokens.colorPaletteRedForeground1 }}>{t.ransomware}</span>}
          {cve?.cvss != null && (
            <span>
              CVSS {cve.cvss.toFixed(1)} {cve.severity ? `· ${cve.severity}` : ""}
            </span>
          )}
          <span>EPSS {pct(kev?.epss ?? cve?.epss ?? null)}</span>
        </Caption1>
      </div>
    </div>
  );

  const body = (
    <>
      <Section s={s} title={t.description}>
        <Body1 className={s.value}>{kev?.shortDescription ?? cve?.description}</Body1>
      </Section>
      {kev && (
        <Section s={s} title={t.requiredAction}>
          <Body1 className={s.value}>{kev.requiredAction}</Body1>
        </Section>
      )}
      <Section s={s} title={t.details}>
        <div className={s.grid}>
          {kev && <Field s={s} label={t.colVendor}>{`${kev.vendorProject} · ${kev.product}`}</Field>}
          {kev && (
            <Field s={s} label={t.colAdded}>
              {kev.dateAdded}
            </Field>
          )}
          {kev && (
            <Field s={s} label={t.colDue}>
              {kev.dueDate}
            </Field>
          )}
          {cve && (
            <Field s={s} label={t.colPublished}>
              {cve.published.slice(0, 10)}
            </Field>
          )}
          <Field s={s} label={t.colEpss}>
            <EpssMark
              epss={kev?.epss ?? cve?.epss ?? null}
              percentile={kev?.epssPercentile ?? cve?.epssPercentile ?? null}
              tip={t.epssTip}
            />
          </Field>
        </div>
      </Section>
      <Section s={s} title={`${t.relatedTopics} (${related.length})`}>
        {related.length === 0 ? (
          <Caption1 className={s.label}>{t.noRelatedTopics}</Caption1>
        ) : (
          <div className={s.related}>
            {related.map((x) => (
              <div key={x.id} className={s.relatedItem}>
                <Link onClick={() => p.onSelect({ kind: "topic", id: x.id })}>{titleOf(L, x)}</Link>
                <Caption1 className={s.label}>
                  {t.sourcesCount(x.sources.length)} · {relativeTime(L, x.lastUpdated)}
                </Caption1>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );

  const footer = (
    <Button appearance="primary" as="a" href={nvd} target="_blank" rel="noopener noreferrer" icon={<OpenRegular />}>
      {t.openNvd}
    </Button>
  );

  return { head, body, footer };
}
