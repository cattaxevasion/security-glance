// 하이픈이 든 영문 식별자(CVE-2026-88771, PAN-OS, Wi-Fi 등)가 하이픈에서 줄이 바뀌지 않게 통째로 묶어 그린다.
// CSS만으로는 하이픈 뒤 줄바꿈을 막을 수 없어서, 그런 덩어리만 white-space: nowrap으로 감싼다.
// (글자는 바꾸지 않으므로 복사·검색 결과는 그대로)
import type { ReactNode } from "react";

/** 영문·숫자를 하이픈으로 이은 덩어리. 너무 긴 것(32자 넘음)은 칸을 넘칠 수 있어 묶지 않는다. */
const HYPHENATED = /[A-Za-z0-9]+(?:[-‐‑][A-Za-z0-9]+)+/g;

export function nb(text: string): ReactNode {
  if (!text || !/[-‐‑]/.test(text)) return text;
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(HYPHENATED)) {
    if (m[0].length > 32) continue;
    if (m.index! > last) out.push(text.slice(last, m.index));
    out.push(
      <span key={m.index} style={{ whiteSpace: "nowrap" }}>
        {m[0]}
      </span>,
    );
    last = m.index! + m[0].length;
  }
  if (!out.length) return text;
  out.push(text.slice(last));
  return out;
}
