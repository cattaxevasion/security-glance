// 토픽 링크 미리보기 이미지 만들기 (B안: 성격 색 전체 배경 + 큰 흰 제목). 사이트 빌드 전에 돈다.
//   npm run og
// 같은 내용(해시)이면 .og-cache에서 그대로 복사하고 다시 그리지 않는다 (Actions에서는 실행 사이에 캐시로 유지).
import { Resvg } from "@resvg/resvg-js";
import { appendFile, copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import satori from "satori";
import sharp from "sharp";
import type { ReactNode } from "react";
import type { Topic } from "../../shared/types";
import type { Lang } from "../../src/i18n";
import { ogHash, ogText, type OgText } from "../../src/share/og";
import { buildTopics } from "../../src/share/topics";

const OUT = "public/og";
const CACHE = ".og-cache";
/** 한 실행에 새로 그리는 최대 수 (한 장 약 0.2초) */
const MAX_DRAW = Number(process.env.OG_MAX_DRAW ?? 150);
const FONT = "node_modules/pretendard/dist/public/static";
const FONT_JP = "node_modules/pretendard-jp/dist/public/static";

// 성격별 배경 (사이트 카드 머리띠와 같은 색)
const STOPS: Record<Topic["nature"], [string, string, string]> = {
  사건: ["#6e0811", "#a4262c", "#6b1f6f"],
  "취약점 공지": ["#7a2d00", "#b4400b", "#8a1f2a"],
  "체포·수사": ["#4b1048", "#8b2a85", "#3d2a8a"],
  "정책·법규": ["#0c2f5e", "#1b5aa6", "#2f3e8f"],
  "연구·리포트": ["#00413f", "#0b6a66", "#0f4c7a"],
  "업계 동향": ["#303030", "#424242", "#4a4a4a"],
};

/** 성격 아이콘 (선 그림, 24 기준) */
function Icon({ nature, size }: { nature: Topic["nature"]; size: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (nature) {
    case "사건":
      return (
        <svg {...common}>
          <path d="M12 2.8 4.5 5.6v5.9c0 4.8 3.2 8.6 7.5 9.7 4.3-1.1 7.5-4.9 7.5-9.7V5.6L12 2.8Z" />
          <path d="M12 7.6v5.2" />
          <circle cx="12" cy="15.9" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      );
    case "취약점 공지":
      return (
        <svg {...common}>
          <rect x="7.5" y="7" width="9" height="12" rx="4.5" />
          <path d="M9.5 7.2a2.5 2.5 0 0 1 5 0M12 11v8M7.5 12H4.5M19.5 12h-3M7.8 16.5 5 18.5M16.2 16.5l2.8 2M8 9 5.5 7M16 9l2.5-2" />
        </svg>
      );
    case "체포·수사":
      return (
        <svg {...common}>
          <path d="m13.5 4.5 6 6M11 7l6 6M14.5 3.5l-6 6 6 6 6-6-6-6ZM11.5 12.5 4 20" />
        </svg>
      );
    case "정책·법규":
      return (
        <svg {...common}>
          <path d="M12 4v16M7 20h10M5 7h14M5 7l-2.5 6a2.5 2.5 0 0 0 5 0L5 7ZM19 7l-2.5 6a2.5 2.5 0 0 0 5 0L19 7Z" />
        </svg>
      );
    case "연구·리포트":
      return (
        <svg {...common}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4M14 3l5 5M14 3v5h5M19 8v3" />
          <circle cx="16.5" cy="16.5" r="3" />
          <path d="m18.7 18.7 2.3 2.3" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M4 19h16M6 15l4-4 3 3 5-6" />
        </svg>
      );
  }
}

function Logo({ size, stroke }: { size: number; stroke: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <path d="M16 2 4 6.5v8.2c0 7.4 5 13.4 12 15.3 7-1.9 12-7.9 12-15.3V6.5L16 2Z" fill="#fff" />
      <circle cx="16" cy="15" r="5.5" fill="none" stroke={stroke} strokeWidth="2.4" />
      <path d="m20 19 4 4" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

// ── 제목 줄 나누기 ──
// satori는 한국어를 숫자와 한글 사이(1,118|만)에서 끊고, 일본어는 줄바꿈 허용 문자를 무시해서 직접 줄을 나눈다.
// 글자 폭은 Pretendard 굵은 글씨 기준으로 어림잡고, 넘칠 때를 대비해 3% 여유를 둔다.
const HIRAGANA = new RegExp(`^[${String.fromCharCode(0x3041)}-${String.fromCharCode(0x309f)}]+$`);
const CLOSING = new RegExp(`^[${String.fromCharCode(0x3001, 0x3002, 0x30fb, 0x300d, 0x300f, 0xff09)}),.]+$`);
const jaWords = new Intl.Segmenter("ja", { granularity: "word" });
const ELLIPSIS = String.fromCharCode(0x2026);
const TITLE_WIDTH = 1060 * 0.97;

/** 글자 하나의 폭 (em) */
function charWidth(ch: string): number {
  if (/\p{Script=Hangul}/u.test(ch)) return 0.93;
  if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(ch) || ch.charCodeAt(0) >= 0x3000) return 1;
  if (ch === " ") return 0.26;
  if (/[A-Z]/.test(ch)) return 0.68;
  if (/[a-z0-9]/.test(ch)) return 0.58;
  return 0.34;
}
const widthOf = (s: string) => [...s].reduce((a, ch) => a + charWidth(ch), 0);

/** 끊을 수 있는 덩어리: 한국어는 띄어쓰기 단위, 일본어는 단어(조사·문장부호·한 글자 한자는 앞에 붙임) */
function tokens(lang: Lang, title: string): string[] {
  if (lang === "ko") return title.split(/(?<= )/);
  const out: string[] = [];
  for (const { segment } of jaWords.segment(title)) {
    const prev = out[out.length - 1];
    const glue =
      prev !== undefined &&
      !prev.endsWith(" ") &&
      (HIRAGANA.test(segment) ||
        CLOSING.test(segment) ||
        // 한자 한 글자(性·超·件 같은 접미어·단위)는 앞의 숫자·한자에 붙인다
        (/^\p{Script=Han}$/u.test(segment) && /[\d\p{Script=Han}]$/u.test(prev)));
    if (glue) out[out.length - 1] = prev + segment;
    else out.push(segment);
  }
  return out;
}

function wrap(parts: string[], size: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const part of parts) {
    if (line && widthOf((line + part).trimEnd()) * size > TITLE_WIDTH) {
      lines.push(line.trimEnd());
      line = part.trimStart();
    } else line += part;
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines;
}

/** 글자 크기와 줄들: 세 줄 안에 드는 가장 큰 크기, 그래도 넘치면 가장 작은 크기로 세 줄 + 말줄임 */
export function layoutTitle(lang: Lang, title: string): { size: number; lines: string[] } {
  const sizes = lang === "ko" ? [76, 68, 62, 56] : [72, 64, 58, 52];
  const parts = tokens(lang, title);
  for (const size of sizes) {
    const lines = wrap(parts, size);
    if (lines.length <= 3) return { size, lines };
  }
  const size = sizes[sizes.length - 1];
  const lines = wrap(parts, size).slice(0, 3);
  let last = lines[2];
  while (last && widthOf(last + ELLIPSIS) * size > TITLE_WIDTH) last = [...last].slice(0, -1).join("");
  lines[2] = last.trimEnd() + ELLIPSIS;
  return { size, lines };
}

function Chip({ children, strong, ink }: { children: ReactNode; strong?: boolean; ink?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 24,
        fontWeight: 700,
        padding: "8px 18px",
        borderRadius: 999,
        backgroundColor: strong ? "#fff" : "rgba(255,255,255,0.16)",
        color: strong ? ink : "#fff",
      }}
    >
      {children}
    </div>
  );
}

function Card({ x }: { x: OgText }) {
  const [a, b, c] = STOPS[x.nature];
  const title = layoutTitle(x.lang, x.title);
  return (
    <div
      style={{
        width: 1200,
        height: 630,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        padding: "60px 70px 48px",
        color: "#fff",
        fontFamily: x.lang === "ja" ? "PJ" : "P",
        backgroundImage: [
          "radial-gradient(700px 360px at 100% 0%, rgba(255,255,255,0.14), rgba(255,255,255,0) 60%)",
          "radial-gradient(600px 300px at 0% 100%, rgba(0,0,0,0.28), rgba(0,0,0,0) 60%)",
          `linear-gradient(125deg, ${a} 0%, ${b} 55%, ${c} 100%)`,
        ].join(", "),
      }}
    >
      <div style={{ position: "absolute", right: -40, bottom: -60, opacity: 0.1, display: "flex", color: "#fff" }}>
        <Icon nature={x.nature} size={420} />
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <Chip strong ink={b}>
          <Icon nature={x.nature} size={26} />
          {x.natureLabel}
        </Chip>
        <Chip>{x.regions}</Chip>
        <Chip>{x.sources}</Chip>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {title.lines.map((line, i) => (
          <div
            key={i}
            style={{
              display: "block",
              maxWidth: 1060,
              fontSize: title.size,
              lineHeight: 1.24,
              fontWeight: 800,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {line}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 25, fontWeight: 600 }}>
        <Logo size={36} stroke={b} />
        Security Glance
        <div style={{ marginLeft: "auto", opacity: 0.8, fontWeight: 500 }}>{x.date}</div>
      </div>
    </div>
  );
}

async function main() {
  const started = Date.now();
  const font = (dir: string, file: string) => readFile(join(dir, file));
  const fonts = [
    { name: "P", data: await font(FONT, "Pretendard-SemiBold.otf"), weight: 600 as const },
    { name: "P", data: await font(FONT, "Pretendard-Bold.otf"), weight: 700 as const },
    { name: "P", data: await font(FONT, "Pretendard-ExtraBold.otf"), weight: 800 as const },
    { name: "PJ", data: await font(FONT_JP, "PretendardJP-SemiBold.otf"), weight: 600 as const },
    { name: "PJ", data: await font(FONT_JP, "PretendardJP-Bold.otf"), weight: 700 as const },
    { name: "PJ", data: await font(FONT_JP, "PretendardJP-ExtraBold.otf"), weight: 800 as const },
  ];

  await rm(OUT, { recursive: true, force: true });
  await mkdir(join(OUT, "ko"), { recursive: true });
  await mkdir(join(OUT, "ja"), { recursive: true });
  await mkdir(CACHE, { recursive: true });

  const used = new Set<string>();
  let drawn = 0;
  let cached = 0;
  let skipped = 0;
  // 최근에 바뀐 토픽부터. 한 실행에 새로 그리는 수에 상한을 둬서 캐시가 비었을 때도 빌드가 길어지지 않게 한다
  // (못 그린 토픽은 공유 페이지가 기본 이미지를 쓰고, 다음 실행에서 이어 그린다)
  // OG_ONLY=id,id 로 일부만 (확인용)
  const only = process.env.OG_ONLY?.split(",");
  const topics = buildTopics()
    .filter((x) => !only || only.includes(x.id))
    .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));
  for (const topic of topics) {
    for (const lang of ["ko", "ja"] as Lang[]) {
      const x = ogText(lang, topic);
      const hash = ogHash(x);
      const key = `${lang}-${hash}.jpg`;
      used.add(key);
      const dest = join(OUT, lang, `${topic.id}-${hash}.jpg`);
      const hit = join(CACHE, key);
      if (existsSync(hit)) {
        await copyFile(hit, dest);
        cached++;
        continue;
      }
      if (drawn >= MAX_DRAW) {
        skipped++;
        continue;
      }
      const svg = await satori(<Card x={x} />, { width: 1200, height: 630, fonts });
      const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng();
      await writeFile(hit, await sharp(png).jpeg({ quality: 84, mozjpeg: true }).toBuffer());
      await copyFile(hit, dest);
      drawn++;
    }
  }
  // 지금 토픽에 안 쓰는 캐시는 지운다 (캐시가 끝없이 커지지 않게)
  let pruned = 0;
  for (const f of await readdir(CACHE)) {
    if (!used.has(f)) {
      await rm(join(CACHE, f));
      pruned++;
    }
  }
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `drawn=${drawn}
`);
  console.log(
    `링크 미리보기 이미지: 새로 그림 ${drawn} · 캐시 ${cached} · 다음으로 미룸 ${skipped} · 지운 캐시 ${pruned} (${((Date.now() - started) / 1000).toFixed(1)}초)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
