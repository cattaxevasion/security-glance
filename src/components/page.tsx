// 페이지 공통 틀: 제목, 명령 줄, 표 스타일
import { Title2, makeStyles, tokens } from "@fluentui/react-components";
import type { ReactNode } from "react";

export const usePageStyles = makeStyles({
  page: {
    padding: "24px 16px 48px",
    "@media (min-width: 641px)": { padding: "28px 32px 48px" },
    maxWidth: "1600px",
  },
  /** 기사 목록은 한 줄이 너무 길어지지 않게 폭을 제한한다 */
  reading: { maxWidth: "1040px" },
  titleRow: { display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "4px" },
  title: { margin: 0 },
  desc: { color: tokens.colorNeutralForeground3, maxWidth: "760px", marginTop: "4px", display: "block" },
  command: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    marginTop: "12px",
    paddingBottom: "4px",
  },
  commandGroup: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px" },
  count: { color: tokens.colorNeutralForeground3, paddingLeft: "4px", whiteSpace: "nowrap" },
  pageSearch: { width: "100%", marginTop: "12px" },
  filters: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", marginBottom: "12px" },
  tableWrap: {
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    overflowX: "auto",
  },
  row: {
    cursor: "pointer",
    ":focus-visible": { outline: `2px solid ${tokens.colorStrokeFocus2}`, outlineOffset: "-2px" },
  },
  groupRow: {
    backgroundColor: tokens.colorNeutralBackground2,
    ":hover": { backgroundColor: tokens.colorNeutralBackground2 },
  },
  groupCell: {
    height: "32px",
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
  },
  groupCount: { fontWeight: tokens.fontWeightRegular, color: tokens.colorNeutralForeground3, marginLeft: "8px" },
  muted: { color: tokens.colorNeutralForeground3 },
  nowrap: { whiteSpace: "nowrap" },
  mono: { fontFamily: tokens.fontFamilyMonospace, whiteSpace: "nowrap" },
  clamp1: {
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  empty: {
    padding: "56px 16px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    alignItems: "center",
    color: tokens.colorNeutralForeground3,
  },
  more: { display: "flex", justifyContent: "center", padding: "16px 0" },
  footer: { display: "block", marginTop: "32px", color: tokens.colorNeutralForeground3, maxWidth: "760px" },
});

export function PageTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  const s = usePageStyles();
  return (
    <div className={s.titleRow}>
      <Title2 as="h1" className={s.title}>
        {children}
      </Title2>
      {aside}
    </div>
  );
}
