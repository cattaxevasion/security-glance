import {
  Badge,
  Body1,
  Caption1,
  InfoLabel,
  Link,
  SearchBox,
  Tab,
  TabList,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Tooltip,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useMemo, useState } from "react";
import type { CveEntry, KevEntry, NewsItem, VulnData } from "../../shared/types";
import { pct } from "./format";

const useStyles = makeStyles({
  head: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px 16px",
    alignItems: "center",
    justifyContent: "space-between",
  },
  search: { minWidth: "220px", maxWidth: "360px", flexGrow: 1 },
  explain: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
    gap: "8px",
    margin: "12px 0",
  },
  explainItem: {
    padding: "10px 14px",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    color: tokens.colorNeutralForeground2,
  },
  scroll: {
    overflowX: "auto",
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  table: { minWidth: "820px" },
  mono: { fontFamily: tokens.fontFamilyMonospace, whiteSpace: "nowrap" },
  desc: {
    color: tokens.colorNeutralForeground2,
    display: "-webkit-box",
    WebkitLineClamp: "2",
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  epss: { display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" },
  bar: {
    width: "48px",
    height: "6px",
    borderRadius: "3px",
    backgroundColor: tokens.colorNeutralBackground4,
    overflow: "hidden",
  },
  nowrap: { whiteSpace: "nowrap" },
  linkButton: {
    border: "none",
    background: "none",
    padding: 0,
    cursor: "pointer",
    font: "inherit",
  },
});

function EpssCell({ epss, percentile }: { epss: number | null; percentile: number | null }) {
  const s = useStyles();
  if (epss == null) return <Caption1>–</Caption1>;
  const color =
    epss >= 0.1
      ? tokens.colorPaletteRedBackground3
      : epss >= 0.01
        ? tokens.colorPaletteDarkOrangeBackground3
        : tokens.colorNeutralForeground3;
  return (
    <Tooltip
      relationship="description"
      content={`30일 안에 악용될 확률 ${pct(epss, 2)} · 전체 CVE 중 상위 ${pct(1 - (percentile ?? 0), 1)}`}
    >
      <span className={s.epss}>
        <span className={s.bar}>
          <span style={{ display: "block", height: "100%", width: `${Math.max(epss * 100, 2)}%`, background: color }} />
        </span>
        <Body1>{pct(epss)}</Body1>
      </span>
    </Tooltip>
  );
}

function CvssBadge({ score }: { score: number | null }) {
  if (score == null) return <Caption1>–</Caption1>;
  return (
    <Badge appearance="filled" color={score >= 9 ? "danger" : score >= 7 ? "severe" : "warning"}>
      {score.toFixed(1)}
    </Badge>
  );
}

type SortDir = "ascending" | "descending";
type KevSort = "dateAdded" | "epss" | "dueDate";
type CveSort = "published" | "cvss" | "epss";

interface Props {
  data: VulnData | null;
  news: NewsItem[];
  query: string;
  setQuery: (q: string) => void;
  onNews: (cve: string) => void;
}

export function VulnView({ data, news, query, setQuery, onNews }: Props) {
  const s = useStyles();
  const [view, setView] = useState<"kev" | "cve">("kev");
  const [kevSort, setKevSort] = useState<{ key: KevSort; dir: SortDir }>({ key: "dateAdded", dir: "descending" });
  const [cveSort, setCveSort] = useState<{ key: CveSort; dir: SortDir }>({ key: "cvss", dir: "descending" });

  const mentions = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of news) for (const c of n.entities.cves) m.set(c, (m.get(c) ?? 0) + 1);
    return m;
  }, [news]);

  const q = query.trim().toLowerCase();

  const kev = useMemo(() => {
    const rows = (data?.kev ?? []).filter(
      (k) => !q || `${k.cveID} ${k.vendorProject} ${k.product} ${k.vulnerabilityName}`.toLowerCase().includes(q),
    );
    const sign = kevSort.dir === "ascending" ? 1 : -1;
    const val = (k: KevEntry) => (kevSort.key === "epss" ? (k.epss ?? -1) : k[kevSort.key]);
    return rows.sort((a, b) => (val(a) > val(b) ? sign : val(a) < val(b) ? -sign : 0));
  }, [data, q, kevSort]);

  const cves = useMemo(() => {
    const rows = (data?.cves ?? []).filter((c) => !q || `${c.id} ${c.description}`.toLowerCase().includes(q));
    const sign = cveSort.dir === "ascending" ? 1 : -1;
    const val = (c: CveEntry) => (cveSort.key === "published" ? c.published : (c[cveSort.key] ?? -1));
    return rows.sort((a, b) => (val(a) > val(b) ? sign : val(a) < val(b) ? -sign : 0)).slice(0, 300);
  }, [data, q, cveSort]);

  function sortProps<K extends string>(cur: { key: K; dir: SortDir }, set: (v: { key: K; dir: SortDir }) => void, key: K) {
    return {
      sortDirection: cur.key === key ? cur.dir : undefined,
      onClick: () =>
        set({ key, dir: cur.key === key && cur.dir === "descending" ? "ascending" : "descending" }),
    };
  }

  const mentionCell = (id: string) => {
    const n = mentions.get(id);
    return n ? (
      <button className={s.linkButton} onClick={() => onNews(id)}>
        <Link as="span">기사 {n}건</Link>
      </button>
    ) : (
      <Caption1>–</Caption1>
    );
  };

  return (
    <div>
      <div className={s.head}>
        <TabList selectedValue={view} onTabSelect={(_, d) => setView(d.value as "kev" | "cve")} size="small">
          <Tab value="kev">실제 악용 중 (KEV · {data?.kev.length ?? 0})</Tab>
          <Tab value="cve">고위험 신규 CVE ({data?.cves.length ?? 0})</Tab>
        </TabList>
        <SearchBox
          className={s.search}
          placeholder="CVE, 벤더, 제품 검색"
          value={query}
          onChange={(_, d) => setQuery(d.value)}
        />
      </div>

      <div className={s.explain}>
        <div className={s.explainItem}>
          <InfoLabel info="CISA가 '실제 공격에 쓰인 것이 확인된' 취약점만 모은 목록이에요. 패치 우선순위를 정할 때 가장 먼저 보는 지표예요.">
            <Body1>
              <b>KEV</b> 실제로 악용이 확인된 취약점 (최근 90일)
            </Body1>
          </InfoLabel>
        </div>
        <div className={s.explainItem}>
          <InfoLabel info="CVSS는 '터지면 얼마나 심각한가', EPSS는 '앞으로 30일 안에 실제로 악용될 확률'이에요. CVSS가 높아도 EPSS가 낮으면 당장 노려지지 않는 경우가 많아요.">
            <Body1>
              <b>CVSS</b> 심각도 · <b>EPSS</b> 악용 가능성
            </Body1>
          </InfoLabel>
        </div>
      </div>

      <div className={s.scroll}>
        {view === "kev" ? (
          <Table className={s.table} sortable size="small" aria-label="KEV 목록">
            <TableHeader>
              <TableRow>
                <TableHeaderCell {...sortProps(kevSort, setKevSort, "dateAdded")}>추가일</TableHeaderCell>
                <TableHeaderCell>CVE</TableHeaderCell>
                <TableHeaderCell>벤더 · 제품</TableHeaderCell>
                <TableHeaderCell>취약점</TableHeaderCell>
                <TableHeaderCell {...sortProps(kevSort, setKevSort, "epss")}>EPSS</TableHeaderCell>
                <TableHeaderCell {...sortProps(kevSort, setKevSort, "dueDate")}>조치 기한</TableHeaderCell>
                <TableHeaderCell>관련 기사</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kev.map((k) => (
                <TableRow key={k.cveID}>
                  <TableCell className={s.nowrap}>{k.dateAdded}</TableCell>
                  <TableCell>
                    <Link className={s.mono} href={`https://nvd.nist.gov/vuln/detail/${k.cveID}`} target="_blank" rel="noopener noreferrer">
                      {k.cveID}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Body1>
                      {k.vendorProject} · {k.product}
                    </Body1>
                  </TableCell>
                  <TableCell>
                    <Tooltip content={k.shortDescription} relationship="description">
                      <span className={s.desc}>
                        {k.ransomware && (
                          <Badge appearance="filled" color="danger" size="small" style={{ marginRight: 6 }}>
                            랜섬웨어
                          </Badge>
                        )}
                        {k.vulnerabilityName}
                      </span>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <EpssCell epss={k.epss} percentile={k.epssPercentile} />
                  </TableCell>
                  <TableCell className={s.nowrap}>{k.dueDate}</TableCell>
                  <TableCell>{mentionCell(k.cveID)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Table className={s.table} sortable size="small" aria-label="고위험 CVE 목록">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>CVE</TableHeaderCell>
                <TableHeaderCell {...sortProps(cveSort, setCveSort, "published")}>게시일</TableHeaderCell>
                <TableHeaderCell {...sortProps(cveSort, setCveSort, "cvss")}>CVSS</TableHeaderCell>
                <TableHeaderCell {...sortProps(cveSort, setCveSort, "epss")}>EPSS</TableHeaderCell>
                <TableHeaderCell>설명</TableHeaderCell>
                <TableHeaderCell>관련 기사</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cves.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link className={s.mono} href={`https://nvd.nist.gov/vuln/detail/${c.id}`} target="_blank" rel="noopener noreferrer">
                      {c.id}
                    </Link>
                    {c.inKev && (
                      <Badge appearance="filled" color="danger" size="small" style={{ marginLeft: 6 }}>
                        KEV
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className={s.nowrap}>{c.published.slice(0, 10)}</TableCell>
                  <TableCell>
                    <CvssBadge score={c.cvss} />
                  </TableCell>
                  <TableCell>
                    <EpssCell epss={c.epss} percentile={c.epssPercentile} />
                  </TableCell>
                  <TableCell>
                    <Tooltip content={c.description} relationship="description">
                      <span className={s.desc}>{c.description}</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell>{mentionCell(c.id)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
