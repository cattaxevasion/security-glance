import {
  Button,
  Caption1,
  Dropdown,
  Option,
  SearchBox,
  Subtitle2,
  Text,
  ToggleButton,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { DismissRegular } from "@fluentui/react-icons";
import { useMemo, useState } from "react";
import { ATTACK_TYPES, NATURES, SECTORS } from "../../shared/taxonomy";
import type { NewsItem } from "../../shared/types";
import { NewsCard } from "./NewsCard";
import { dayKey, dayLabel } from "./format";

export interface NewsFilters {
  q: string;
  attack: string[];
  sector: string[];
  nature: string[];
  days: number; // 0 = 전체
}

export const EMPTY_FILTERS: NewsFilters = { q: "", attack: [], sector: [], nature: [], days: 0 };

const PERIODS = [
  { days: 1, label: "24시간" },
  { days: 3, label: "3일" },
  { days: 7, label: "7일" },
  { days: 30, label: "30일" },
  { days: 0, label: "전체 기간" },
];

const PAGE = 40;

const useStyles = makeStyles({
  toolbar: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    alignItems: "center",
  },
  search: { flexGrow: 1, minWidth: "220px", maxWidth: "420px" },
  dropdown: { minWidth: "130px" },
  chips: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginTop: "10px",
  },
  count: { color: tokens.colorNeutralForeground3, marginLeft: "4px" },
  summaryLine: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "14px",
    color: tokens.colorNeutralForeground3,
  },
  day: {
    position: "sticky",
    top: "0",
    zIndex: 1,
    padding: "14px 0 8px",
    backgroundColor: tokens.colorNeutralBackground2,
    display: "flex",
    alignItems: "baseline",
    gap: "8px",
  },
  list: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 460px), 1fr))",
    gap: "12px",
  },
  empty: {
    padding: "48px 0",
    textAlign: "center",
    color: tokens.colorNeutralForeground3,
  },
  more: { display: "flex", justifyContent: "center", padding: "20px 0" },
});

function toggle(list: string[], v: string): string[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function matchesQuery(n: NewsItem, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  const hay = [
    n.titleKo,
    n.title,
    n.sourceName,
    n.titleJa,
    ...n.summaryKo,
    ...n.summaryJa,
    ...n.entities.cves,
    ...n.entities.actors,
    ...n.entities.orgs,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

interface Props {
  items: NewsItem[];
  filters: NewsFilters;
  setFilters: (f: NewsFilters) => void;
  epss: Record<string, { epss: number; percentile: number }>;
  onCve: (cve: string) => void;
}

export function NewsView({ items, filters, setFilters, epss, onCve }: Props) {
  const s = useStyles();
  const [shown, setShown] = useState(PAGE);
  const set = (patch: Partial<NewsFilters>) => {
    setShown(PAGE);
    setFilters({ ...filters, ...patch });
  };

  // 검색어·기간까지 적용한 집합. 태그 개수는 여기서 센다.
  const base = useMemo(() => {
    const since = filters.days ? Date.now() - filters.days * 86400_000 : 0;
    return items.filter((n) => Date.parse(n.publishedAt) >= since && matchesQuery(n, filters.q));
  }, [items, filters.q, filters.days]);

  const filtered = useMemo(
    () =>
      base.filter(
        (n) =>
          filters.attack.every((t) => (n.attackTypes as string[]).includes(t)) &&
          (filters.sector.length === 0 || filters.sector.some((t) => (n.sectors as string[]).includes(t))) &&
          (filters.nature.length === 0 || filters.nature.includes(n.nature)),
      ),
    [base, filters.attack, filters.sector, filters.nature],
  );

  const attackCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of base) for (const t of n.attackTypes) m.set(t, (m.get(t) ?? 0) + 1);
    return m;
  }, [base]);

  const groups = useMemo(() => {
    const out: { key: string; label: string; items: NewsItem[] }[] = [];
    for (const n of filtered.slice(0, shown)) {
      const key = dayKey(n.publishedAt);
      const last = out[out.length - 1];
      if (last?.key === key) last.items.push(n);
      else out.push({ key, label: dayLabel(n.publishedAt), items: [n] });
    }
    return out;
  }, [filtered, shown]);

  const active =
    filters.q || filters.attack.length || filters.sector.length || filters.nature.length || filters.days !== 0;

  return (
    <div>
      <div className={s.toolbar}>
        <SearchBox
          className={s.search}
          placeholder="제목, 요약, CVE, 그룹명, 기업명 검색"
          value={filters.q}
          onChange={(_, d) => set({ q: d.value })}
        />
        <Dropdown
          className={s.dropdown}
          value={PERIODS.find((p) => p.days === filters.days)?.label}
          selectedOptions={[String(filters.days)]}
          onOptionSelect={(_, d) => set({ days: Number(d.optionValue) })}
          aria-label="기간"
        >
          {PERIODS.map((p) => (
            <Option key={p.days} value={String(p.days)}>
              {p.label}
            </Option>
          ))}
        </Dropdown>
        <Dropdown
          className={s.dropdown}
          multiselect
          placeholder="대상 산업"
          value={filters.sector.join(", ")}
          selectedOptions={filters.sector}
          onOptionSelect={(_, d) => set({ sector: d.selectedOptions })}
          aria-label="대상 산업"
        >
          {SECTORS.map((t) => (
            <Option key={t} value={t}>
              {t}
            </Option>
          ))}
        </Dropdown>
        <Dropdown
          className={s.dropdown}
          multiselect
          placeholder="기사 성격"
          value={filters.nature.join(", ")}
          selectedOptions={filters.nature}
          onOptionSelect={(_, d) => set({ nature: d.selectedOptions })}
          aria-label="기사 성격"
        >
          {NATURES.map((t) => (
            <Option key={t} value={t}>
              {t}
            </Option>
          ))}
        </Dropdown>
        {active ? (
          <Button appearance="subtle" icon={<DismissRegular />} onClick={() => set(EMPTY_FILTERS)}>
            필터 초기화
          </Button>
        ) : null}
      </div>

      <div className={s.chips} role="group" aria-label="공격 유형">
        {ATTACK_TYPES.map((t) => {
          const count = attackCounts.get(t) ?? 0;
          const on = filters.attack.includes(t);
          return (
            <ToggleButton
              key={t}
              size="small"
              shape="circular"
              checked={on}
              disabled={!on && count === 0}
              onClick={() => set({ attack: toggle(filters.attack, t) })}
            >
              {t}
              <span className={s.count}>{count}</span>
            </ToggleButton>
          );
        })}
      </div>

      <div className={s.summaryLine}>
        <Caption1>
          {filtered.length}건{filtered.length !== items.length ? ` / 전체 ${items.length}건` : ""}
        </Caption1>
      </div>

      {filtered.length === 0 ? (
        <div className={s.empty}>
          <Text>조건에 맞는 기사가 없어요.</Text>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.key}>
            <div className={s.day}>
              <Subtitle2>{g.label}</Subtitle2>
              <Caption1>{g.items.length}건</Caption1>
            </div>
            <div className={s.list}>
              {g.items.map((n) => (
                <NewsCard key={n.id} item={n} epss={epss} onSearch={(q) => set({ q })} onCve={onCve} />
              ))}
            </div>
          </section>
        ))
      )}

      {filtered.length > shown && (
        <div className={s.more}>
          <Button onClick={() => setShown(shown + PAGE)}>더 보기 ({filtered.length - shown}건 남음)</Button>
        </div>
      )}
    </div>
  );
}
