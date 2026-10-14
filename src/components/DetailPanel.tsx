// 오른쪽 상세 패널. Defender처럼 위·아래 화살표로 목록의 이전·다음 항목으로 이동한다.
import {
  Body1,
  Button,
  Caption1,
  Divider,
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
  DismissRegular,
  LinkRegular,
  OpenRegular,
  ShieldErrorRegular,
  BugRegular,
  SparkleRegular,
} from "@fluentui/react-icons";
import { useState, type ReactNode } from "react";
import type { CveEntry, KevEntry, NewsItem, VulnData } from "../../shared/types";
import { REGION_LABELS, STRINGS, tagLabel, type Lang } from "../i18n";
import { fullDateTime, pct, relativeTime } from "./format";
import { EpssMark, NATURE_COLOR, NATURE_ICON, NatureMark } from "./marks";

export type Selection = { kind: "news"; id: string } | { kind: "kev" | "cve"; id: string };

const useStyles = makeStyles({
  surface: { boxShadow: tokens.shadow64 },
  inline: {
    width: "min(520px, 42vw)",
    height: "100%",
    backgroundColor: tokens.colorNeutralBackground1,
  },
  topBar: { display: "flex", justifyContent: "flex-end", gap: "2px", marginRight: "-8px", marginTop: "-8px" },
  heading: { display: "flex", gap: "16px", alignItems: "flex-start", marginTop: "4px" },
  iconCircle: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontSize: "24px",
  },
  headText: { display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 },
  title: { overflowWrap: "anywhere" },
  metaRow: { display: "flex", flexWrap: "wrap", gap: "4px 16px", color: tokens.colorNeutralForeground2 },
  actions: { marginTop: "12px", marginLeft: "-8px" },
  body: { display: "flex", flexDirection: "column", gap: "0", paddingBottom: "16px" },
  section: { padding: "16px 0", borderTop: `1px solid ${tokens.colorNeutralStroke2}` },
  sectionTitle: { display: "block", marginBottom: "10px" },
  summary: {
    margin: 0,
    paddingLeft: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    fontSize: "15px",
    lineHeight: "26px",
    color: tokens.colorNeutralForeground1,
    wordBreak: "keep-all",
    overflowWrap: "anywhere",
  },
  value: { lineHeight: "22px", overflowWrap: "anywhere" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "14px 24px",
  },
  field: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 },
  full: { gridColumn: "1 / -1" },
  label: { color: tokens.colorNeutralForeground3 },
  tags: { display: "flex", flexWrap: "wrap", gap: "6px" },
  cveRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "6px 0",
    borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
  },
  mono: { fontFamily: tokens.fontFamilyMonospace },
  linkButton: { border: "none", background: "none", padding: 0, font: "inherit", cursor: "pointer", textAlign: "left" },
  notice: { display: "flex", gap: "6px", alignItems: "flex-start", color: tokens.colorNeutralForeground3, paddingTop: "12px" },
  related: { display: "flex", flexDirection: "column", gap: "10px" },
  relatedItem: { display: "flex", flexDirection: "column", gap: "2px" },
  footer: { borderTop: `1px solid ${tokens.colorNeutralStroke2}`, paddingTop: "12px" },
});

function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  const s = useStyles();
  return (
    <div className={mergeClasses(s.field, full && s.full)}>
      <Caption1 className={s.label}>{label}</Caption1>
      <Body1 className={s.value}>{children}</Body1>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const s = useStyles();
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
  news: NewsItem[];
  vulns: VulnData | null;
  order: string[];
  onSelect: (sel: Selection | null) => void;
  onSearch: (q: string) => void;
}

export function DetailPanel(p: Props) {
  const s = useStyles();
  const t = STRINGS[p.lang];
  const sel = p.selection;
  const [copied, setCopied] = useState(false);

  const idx = sel ? p.order.indexOf(sel.id) : -1;
  const go = (delta: number) => {
    const next = p.order[idx + delta];
    if (sel && next) p.onSelect({ ...sel, id: next });
  };

  let content: { head: ReactNode; body: ReactNode; footer: ReactNode } | null = null;
  if (sel?.kind === "news") {
    const n = p.news.find((x) => x.id === sel.id);
    if (n) content = newsContent(n, p, s, copied, setCopied);
  } else if (sel) {
    const v = sel.kind === "kev" ? p.vulns?.kev.find((k) => k.cveID === sel.id) : p.vulns?.cves.find((c) => c.id === sel.id);
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
            <Button appearance="subtle" icon={<ArrowDownRegular />} disabled={idx < 0 || idx >= p.order.length - 1} onClick={() => go(1)} />
          </Tooltip>
          <Tooltip content={t.close} relationship="label">
            <Button appearance="subtle" icon={<DismissRegular />} onClick={() => p.onSelect(null)} />
          </Tooltip>
        </div>
        {content.head}
      </DrawerHeader>
      <DrawerBody className={s.body}>{content.body}</DrawerBody>
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

type Styles = ReturnType<typeof useStyles>;

function newsContent(n: NewsItem, p: Props, s: Styles, copied: boolean, setCopied: (v: boolean) => void) {
  const L = p.lang;
  const t = STRINGS[L];
  const Icon = NATURE_ICON[n.nature];
  const title = L === "ja" ? n.titleJa || n.titleKo : n.titleKo;
  const summary = L === "ja" && n.summaryJa.length ? n.summaryJa : n.summaryKo;
  const epss = p.vulns?.mentioned ?? {};

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(n.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // 클립보드 권한이 없으면 조용히 넘어간다
    }
  };

  const head = (
    <>
      <div className={s.heading}>
        <span
          className={s.iconCircle}
          style={{ color: NATURE_COLOR[n.nature], backgroundColor: tokens.colorNeutralBackground3 }}
          aria-hidden
        >
          <Icon />
        </span>
        <div className={s.headText}>
          <Subtitle1 as="h2" className={s.title}>
            {title}
          </Subtitle1>
          <Caption1 className={s.metaRow}>
            <NatureMark nature={n.nature} lang={L} />
            <span>{n.regions.map((r) => REGION_LABELS[L][r]).join(" · ")}</span>
            <span>
              {n.sourceName} · {relativeTime(L, n.publishedAt)}
            </span>
          </Caption1>
        </div>
      </div>
      <Toolbar size="small" className={s.actions}>
        <ToolbarButton as="a" href={n.url} target="_blank" rel="noopener noreferrer" icon={<OpenRegular />}>
          {t.openArticle}
        </ToolbarButton>
        <ToolbarButton icon={<LinkRegular />} onClick={copy}>
          {copied ? t.copied : t.copyLink}
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

  const body = (
    <>
      <Section title={t.summary}>
        <ul className={s.summary}>
          {summary.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </Section>

      <Section title={t.classification}>
        <div className={s.grid}>
          <Field label={t.attackTypes}>{tagList(n.attackTypes)}</Field>
          <Field label={t.sectors}>{tagList(n.sectors)}</Field>
        </div>
      </Section>

      {(n.entities.cves.length > 0 || n.entities.actors.length > 0 || n.entities.orgs.length > 0) && (
        <Section title={t.entities}>
          <div className={s.grid}>
            {n.entities.cves.length > 0 && (
              <Field label={t.cves} full>
                {n.entities.cves.map((cve) => (
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
                      <EpssMark epss={epss[cve]?.epss ?? null} percentile={epss[cve]?.percentile ?? null} tip={t.epssTip} />
                    </Caption1>
                  </div>
                ))}
              </Field>
            )}
            {n.entities.actors.length > 0 && (
              <Field label={t.actors}>
                <div className={s.tags}>
                  {n.entities.actors.map((a) => (
                    <Tag key={a} size="small" appearance="brand" as="button" onClick={() => p.onSearch(a)}>
                      {a}
                    </Tag>
                  ))}
                </div>
              </Field>
            )}
            {n.entities.orgs.length > 0 && <Field label={t.orgs}>{n.entities.orgs.join(", ")}</Field>}
          </div>
        </Section>
      )}

      <Section title={t.details}>
        <div className={s.grid}>
          <Field label={t.source}>{n.sourceName}</Field>
          <Field label={t.published}>{fullDateTime(L, n.publishedAt)}</Field>
          <Field label={t.basis}>{t.basisLabel[n.basis]}</Field>
          <Field label={t.regions}>{n.regions.map((r) => REGION_LABELS[L][r]).join(", ")}</Field>
          {n.title !== title && (
            <Field label={t.originalTitle} full>
              {n.title}
            </Field>
          )}
        </div>
        <Caption1 className={s.notice}>
          <SparkleRegular aria-hidden />
          {t.aiNotice}
        </Caption1>
      </Section>
    </>
  );

  const footer = (
    <Button appearance="primary" as="a" href={n.url} target="_blank" rel="noopener noreferrer" icon={<OpenRegular />}>
      {t.openArticle}
    </Button>
  );

  return { head, body, footer };
}

function vulnContent(kind: "kev" | "cve", v: KevEntry | CveEntry, p: Props, s: Styles) {
  const L = p.lang;
  const t = STRINGS[L];
  const id = kind === "kev" ? (v as KevEntry).cveID : (v as CveEntry).id;
  const kev = kind === "kev" ? (v as KevEntry) : p.vulns?.kev.find((k) => k.cveID === id);
  const cve = kind === "cve" ? (v as CveEntry) : p.vulns?.cves.find((c) => c.id === id);
  const related = p.news.filter((n) => n.entities.cves.includes(id));
  const nvd = `https://nvd.nist.gov/vuln/detail/${id}`;

  const head = (
    <div className={s.heading}>
      <span
        className={s.iconCircle}
        style={{
          color: kev ? tokens.colorPaletteRedForeground1 : tokens.colorPaletteDarkOrangeForeground1,
          backgroundColor: tokens.colorNeutralBackground3,
        }}
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
      <Section title={t.description}>
        <Body1>{kev?.shortDescription ?? cve?.description}</Body1>
      </Section>
      {kev && (
        <Section title={t.requiredAction}>
          <Body1>{kev.requiredAction}</Body1>
        </Section>
      )}
      <Section title={t.details}>
        <div className={s.grid}>
          {kev && <Field label={t.colVendor}>{`${kev.vendorProject} · ${kev.product}`}</Field>}
          {kev && <Field label={t.colAdded}>{kev.dateAdded}</Field>}
          {kev && <Field label={t.colDue}>{kev.dueDate}</Field>}
          {cve && <Field label={t.colPublished}>{cve.published.slice(0, 10)}</Field>}
          <Field label={t.colEpss}>
            <EpssMark
              epss={kev?.epss ?? cve?.epss ?? null}
              percentile={kev?.epssPercentile ?? cve?.epssPercentile ?? null}
              tip={t.epssTip}
            />
          </Field>
        </div>
      </Section>
      <Section title={`${t.relatedNews} (${related.length})`}>
        {related.length === 0 ? (
          <Caption1 className={s.label}>{t.noRelated}</Caption1>
        ) : (
          <div className={s.related}>
            {related.map((n) => (
              <div key={n.id} className={s.relatedItem}>
                <Link onClick={() => p.onSelect({ kind: "news", id: n.id })}>
                  {L === "ja" ? n.titleJa || n.titleKo : n.titleKo}
                </Link>
                <Caption1 className={s.label}>
                  {n.sourceName} · {relativeTime(L, n.publishedAt)}
                </Caption1>
              </div>
            ))}
          </div>
        )}
      </Section>
      <Divider />
    </>
  );

  const footer = (
    <Button appearance="primary" as="a" href={nvd} target="_blank" rel="noopener noreferrer" icon={<OpenRegular />}>
      {t.openNvd}
    </Button>
  );

  return { head, body, footer };
}
