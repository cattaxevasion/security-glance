import {
  Badge,
  Body1,
  Caption1,
  Card,
  Link,
  Tooltip,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { OpenRegular } from "@fluentui/react-icons";
import { REGION_LABEL } from "../../shared/taxonomy";
import type { Basis, NewsItem } from "../../shared/types";
import { fullDateTime, pct, relativeTime } from "./format";

const useStyles = makeStyles({
  card: {
    padding: "16px 20px",
    gap: "10px",
  },
  tags: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
    alignItems: "center",
  },
  title: {
    fontSize: tokens.fontSizeBase400,
    lineHeight: tokens.lineHeightBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    textDecorationLine: "none",
    ":hover": { textDecorationLine: "underline" },
  },
  original: {
    color: tokens.colorNeutralForeground3,
    display: "block",
    marginTop: "2px",
  },
  summary: {
    margin: 0,
    paddingLeft: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    color: tokens.colorNeutralForeground2,
  },
  soc: {
    display: "flex",
    gap: "8px",
    alignItems: "flex-start",
    padding: "8px 12px",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorNeutralForeground1,
  },
  socIcon: {
    color: tokens.colorBrandForeground1,
    fontSize: "18px",
    flexShrink: 0,
    marginTop: "1px",
  },
  socLabel: {
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorBrandForeground1,
    marginRight: "6px",
  },
  footer: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "6px 10px",
    color: tokens.colorNeutralForeground3,
  },
  chip: {
    cursor: "pointer",
    border: "none",
    font: "inherit",
    padding: 0,
    background: "none",
  },
  spacer: { flexGrow: 1 },
  mono: { fontFamily: tokens.fontFamilyMonospace },
});

const BASIS_HINT: Record<Basis, string> = {
  본문: "기사 본문을 읽고 요약했어요.",
  요지: "본문을 읽지 못해 RSS 요지만으로 요약했어요. 원문을 확인하세요.",
  제목: "제목만으로 정리했어요. 원문을 꼭 확인하세요.",
};

interface Props {
  item: NewsItem;
  epss: Record<string, { epss: number; percentile: number }>;
  onSearch: (q: string) => void;
  onCve: (cve: string) => void;
}

export function NewsCard({ item, epss, onSearch, onCve }: Props) {
  const s = useStyles();
  const translated = item.titleKo !== item.title;

  return (
    <Card className={s.card} appearance="filled-alternative" role="article">
      <div className={s.tags}>
        {item.regions.map((r) => (
          <Badge key={r} appearance="filled" color={r === "KR" ? "brand" : r === "JP" ? "danger" : "informative"} size="small">
            {REGION_LABEL[r]}
          </Badge>
        ))}
        <Badge appearance="tint" color="subtle" size="small">
          {item.nature}
        </Badge>
        {item.attackTypes.map((t) => (
          <Badge key={t} appearance="tint" color="warning" size="small">
            {t}
          </Badge>
        ))}
        {item.sectors.map((t) => (
          <Badge key={t} appearance="outline" color="informative" size="small">
            {t}
          </Badge>
        ))}
      </div>

      <div>
        <Link href={item.url} target="_blank" rel="noopener noreferrer" className={s.title}>
          {item.titleKo}
        </Link>
        {translated && <Caption1 className={s.original}>{item.title}</Caption1>}
      </div>

      {item.summaryKo.length > 0 && (
        <ul className={s.summary}>
          {item.summaryKo.map((line, i) => (
            <li key={i}>
              <Body1>{line}</Body1>
            </li>
          ))}
        </ul>
      )}


      <div className={s.footer}>
        <Caption1>{item.sourceName}</Caption1>
        <Tooltip content={fullDateTime(item.publishedAt)} relationship="description">
          <Caption1>{relativeTime(item.publishedAt)}</Caption1>
        </Tooltip>
        <Tooltip content={BASIS_HINT[item.basis]} relationship="description">
          <Badge appearance="outline" color={item.basis === "본문" ? "success" : "warning"} size="small">
            {item.basis} 기반
          </Badge>
        </Tooltip>

        {item.entities.cves.map((cve) => {
          const e = epss[cve];
          return (
            <Tooltip
              key={cve}
              relationship="description"
              content={e ? `EPSS ${pct(e.epss)} (상위 ${pct(1 - e.percentile, 0)}) · 취약점 탭에서 보기` : "취약점 탭에서 보기"}
            >
              <button className={s.chip} onClick={() => onCve(cve)}>
                <Badge appearance="tint" color="danger" size="small" className={s.mono}>
                  {cve}
                </Badge>
              </button>
            </Tooltip>
          );
        })}
        {item.entities.actors.map((a) => (
          <Tooltip key={a} content={`"${a}" 관련 기사 모아보기`} relationship="description">
            <button className={s.chip} onClick={() => onSearch(a)}>
              <Badge appearance="tint" color="severe" size="small">
                {a}
              </Badge>
            </button>
          </Tooltip>
        ))}

        <span className={s.spacer} />
        <Link href={item.url} target="_blank" rel="noopener noreferrer">
          <Caption1>
            원문 <OpenRegular aria-hidden />
          </Caption1>
        </Link>
      </div>
    </Card>
  );
}
