import {
  Badge,
  Button,
  Body1,
  Caption1,
  SearchBox,
  Subtitle1,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { useEffect, useMemo, useState } from "react";
import type { CveEntry, KevEntry, Topic, VulnData } from "../../shared/types";
import { STRINGS, type Lang } from "../i18n";
import { vulnTypeOf } from "./text";
import { EpssMark } from "./marks";
import { PageTitle, usePageStyles } from "./page";

type SortDir = "ascending" | "descending";

const PAGE = 100;

const useStyles = makeStyles({
  colDate: { width: "104px" },
  colCve: { width: "156px" },
  colVendor: { width: "180px" },
  colEpss: { width: "120px" },
  colCvss: { width: "84px" },
  colNews: { width: "96px" },
  cell: { paddingTop: "10px", paddingBottom: "10px" },
  ransom: { marginLeft: "8px" },
  nameCell: { display: "flex", alignItems: "center", gap: "8px", minWidth: 0 },
  // 취약점 종류(화면 언어) + 원래 영문 이름
  nameStack: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 },
  vulnType: { fontWeight: tokens.fontWeightSemibold },
  vulnEn: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  // 이름·설명은 두 줄까지 보여준다 (한 줄로 자르면 무슨 취약점인지 읽을 수 없다)
  clamp2: {
    display: "-webkit-box",
    WebkitLineClamp: "2",
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    minWidth: 0,
    fontSize: tokens.fontSizeBase300,
    lineHeight: "20px",
    color: tokens.colorNeutralForeground1,
  },
  newsCount: { color: tokens.colorBrandForeground1, fontWeight: tokens.fontWeightSemibold },
});

interface Props {
  lang: Lang;
  kind: "kev" | "cve";
  data: VulnData | null;
  topics: Topic[];
  query: string;
  setQuery: (q: string) => void;
  narrow: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOrder: (ids: string[]) => void;
}

/** KEV 취약점 이름: 종류를 화면 언어로 먼저, 원래 영문 이름을 아래에 */
function VulnName({ lang, english }: { lang: Lang; english: string }) {
  const s = useStyles();
  const type = vulnTypeOf(lang, english);
  if (!type) return <span className={s.clamp2}>{english}</span>;
  return (
    <span className={s.nameStack}>
      <span className={s.vulnType}>{type}</span>
      <span className={mergeClasses(s.clamp2, s.vulnEn)}>{english}</span>
    </span>
  );
}

export function VulnPage(p: Props) {
  const { lang, kind, narrow } = p;
  const s = useStyles();
  const ps = usePageStyles();
  const t = STRINGS[lang];
  const [sort, setSort] = useState<{ key: string; dir: SortDir }>(
    kind === "kev" ? { key: "dateAdded", dir: "descending" } : { key: "cvss", dir: "descending" },
  );
  useEffect(
    () => setSort(kind === "kev" ? { key: "dateAdded", dir: "descending" } : { key: "cvss", dir: "descending" }),
    [kind],
  );

  const mentions = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of p.topics) for (const c of n.entities.cves) m.set(c, (m.get(c) ?? 0) + 1);
    return m;
  }, [p.topics]);

  const q = p.query.trim().toLowerCase();
  const sign = sort.dir === "ascending" ? 1 : -1;
  const cmp =
    <T,>(val: (x: T) => string | number) =>
    (a: T, b: T) =>
      val(a) > val(b) ? sign : val(a) < val(b) ? -sign : 0;

  const kevRows = useMemo(() => {
    if (kind !== "kev") return [];
    const rows = (p.data?.kev ?? []).filter(
      (k) => !q || `${k.cveID} ${k.vendorProject} ${k.product} ${k.vulnerabilityName}`.toLowerCase().includes(q),
    );
    const val = (k: KevEntry) =>
      sort.key === "epss"
        ? (k.epss ?? -1)
        : sort.key === "news"
          ? (mentions.get(k.cveID) ?? 0)
          : sort.key === "dueDate"
            ? k.dueDate
            : k.dateAdded;
    return [...rows].sort(cmp(val));
  }, [kind, p.data, q, sort, mentions]); // eslint-disable-line react-hooks/exhaustive-deps

  const cveRows = useMemo(() => {
    if (kind !== "cve") return [];
    const rows = (p.data?.cves ?? []).filter((c) => !q || `${c.id} ${c.description}`.toLowerCase().includes(q));
    const val = (c: CveEntry) =>
      sort.key === "epss"
        ? (c.epss ?? -1)
        : sort.key === "published"
          ? c.published
          : sort.key === "news"
            ? (mentions.get(c.id) ?? 0)
            : (c.cvss ?? -1);
    return [...rows].sort(cmp(val));
  }, [kind, p.data, q, sort, mentions]); // eslint-disable-line react-hooks/exhaustive-deps

  // 표는 한 번에 PAGE행씩 그리고 '더 보기'로 늘린다 (예전엔 400행에서 말없이 잘렸다)
  const [shown, setShown] = useState(PAGE);
  useEffect(() => setShown(PAGE), [kind, q, sort]);
  const kevVisible = useMemo(() => kevRows.slice(0, shown), [kevRows, shown]);
  const cveVisible = useMemo(() => cveRows.slice(0, shown), [cveRows, shown]);

  const ids = useMemo(
    () => (kind === "kev" ? kevVisible.map((k) => k.cveID) : cveVisible.map((c) => c.id)),
    [kind, kevVisible, cveVisible],
  );
  useEffect(() => p.onOrder(ids), [ids]); // eslint-disable-line react-hooks/exhaustive-deps

  const sortable = (key: string) => ({
    sortDirection: sort.key === key ? sort.dir : undefined,
    onClick: () => setSort({ key, dir: sort.key === key && sort.dir === "descending" ? "ascending" : "descending" }),
  });

  const rowProps = (id: string) => ({
    className: ps.row,
    appearance: (id === p.selectedId ? "brand" : "none") as "brand" | "none",
    "aria-selected": id === p.selectedId,
    tabIndex: 0,
    onClick: () => p.onSelect(id),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        p.onSelect(id);
      }
    },
  });

  const newsCell = (id: string) => {
    const n = mentions.get(id);
    return n ? <Caption1 className={s.newsCount}>{n}</Caption1> : <Caption1 className={ps.muted}>–</Caption1>;
  };

  const count = kind === "kev" ? kevRows.length : cveRows.length;

  return (
    <div className={ps.page}>
      <PageTitle>{kind === "kev" ? t.kevTitle : t.cveTitle}</PageTitle>
      <Body1 className={ps.desc}>{kind === "kev" ? t.kevDesc : t.cveDesc}</Body1>

      <div className={ps.command}>
        <span />
        <Caption1 className={ps.count}>{t.count(count)}</Caption1>
        {narrow && (
          <SearchBox
            className={ps.pageSearch}
            placeholder={t.vulnSearch}
            value={p.query}
            onChange={(_, d) => p.setQuery(d.value)}
          />
        )}
      </div>

      <div className={ps.tableWrap}>
        {count === 0 ? (
          <div className={ps.empty}>
            <Subtitle1>{t.empty}</Subtitle1>
          </div>
        ) : kind === "kev" ? (
          <Table
            size="small"
            sortable
            aria-label={t.kevTitle}
            style={{ tableLayout: "fixed", minWidth: narrow ? 640 : 900 }}
          >
            <TableHeader>
              <TableRow>
                <TableHeaderCell className={s.colDate} {...sortable("dateAdded")}>
                  {t.colAdded}
                </TableHeaderCell>
                <TableHeaderCell className={s.colCve}>{t.colCve}</TableHeaderCell>
                <TableHeaderCell className={s.colVendor}>{t.colVendor}</TableHeaderCell>
                <TableHeaderCell>{t.colVuln}</TableHeaderCell>
                <TableHeaderCell className={s.colEpss} {...sortable("epss")}>
                  {t.colEpss}
                </TableHeaderCell>
                <TableHeaderCell className={s.colDate} {...sortable("dueDate")}>
                  {t.colDue}
                </TableHeaderCell>
                <TableHeaderCell className={s.colNews} {...sortable("news")}>
                  {t.colNews}
                </TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kevVisible.map((k) => (
                <TableRow key={k.cveID} {...rowProps(k.cveID)}>
                  <TableCell className={ps.nowrap}>
                    <Caption1>{k.dateAdded}</Caption1>
                  </TableCell>
                  <TableCell>
                    <Caption1 className={ps.mono}>{k.cveID}</Caption1>
                  </TableCell>
                  <TableCell>
                    <Caption1 className={ps.clamp1}>
                      {k.vendorProject} · {k.product}
                    </Caption1>
                  </TableCell>
                  <TableCell className={s.cell}>
                    <span className={s.nameCell}>
                      <VulnName lang={lang} english={k.vulnerabilityName} />
                      {k.ransomware && (
                        <Badge size="small" appearance="tint" color="danger">
                          {t.ransomware}
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Caption1>
                      <EpssMark epss={k.epss} percentile={k.epssPercentile} tip={t.epssTip} />
                    </Caption1>
                  </TableCell>
                  <TableCell className={ps.nowrap}>
                    <Caption1>{k.dueDate}</Caption1>
                  </TableCell>
                  <TableCell>{newsCell(k.cveID)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Table
            size="small"
            sortable
            aria-label={t.cveTitle}
            style={{ tableLayout: "fixed", minWidth: narrow ? 640 : 900 }}
          >
            <TableHeader>
              <TableRow>
                <TableHeaderCell className={s.colCve}>{t.colCve}</TableHeaderCell>
                <TableHeaderCell className={s.colDate} {...sortable("published")}>
                  {t.colPublished}
                </TableHeaderCell>
                <TableHeaderCell className={s.colCvss} {...sortable("cvss")}>
                  {t.colCvss}
                </TableHeaderCell>
                <TableHeaderCell className={s.colEpss} {...sortable("epss")}>
                  {t.colEpss}
                </TableHeaderCell>
                <TableHeaderCell>{t.colDesc}</TableHeaderCell>
                <TableHeaderCell className={s.colNews} {...sortable("news")}>
                  {t.colNews}
                </TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cveVisible.map((c) => (
                <TableRow key={c.id} {...rowProps(c.id)}>
                  <TableCell>
                    <Caption1 className={ps.mono}>{c.id}</Caption1>
                    {c.inKev && (
                      <Badge className={s.ransom} size="small" appearance="filled" color="danger">
                        KEV
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className={ps.nowrap}>
                    <Caption1>{c.published.slice(0, 10)}</Caption1>
                  </TableCell>
                  <TableCell>
                    {c.cvss != null ? (
                      <Badge appearance="tint" color={c.cvss >= 9 ? "danger" : "warning"} size="medium">
                        {c.cvss.toFixed(1)}
                      </Badge>
                    ) : (
                      <Caption1>–</Caption1>
                    )}
                  </TableCell>
                  <TableCell>
                    <Caption1>
                      <EpssMark epss={c.epss} percentile={c.epssPercentile} tip={t.epssTip} />
                    </Caption1>
                  </TableCell>
                  <TableCell className={s.cell}>
                    <span className={s.nameStack}>
                      {vulnTypeOf(lang, c.description) && (
                        <span className={s.vulnType}>{vulnTypeOf(lang, c.description)}</span>
                      )}
                      <span className={mergeClasses(s.clamp2, vulnTypeOf(lang, c.description) ? s.vulnEn : undefined)}>
                        {c.description}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>{newsCell(c.id)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {count > shown && (
        <div className={ps.more}>
          <Button onClick={() => setShown(shown + PAGE)}>{t.more(count - shown)}</Button>
        </div>
      )}

      <Caption1 className={ps.footer}>{t.footer}</Caption1>
    </div>
  );
}
