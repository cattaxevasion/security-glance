// 화면 언어가 섞이지 않게 막는 검사. 배포 전에 GitHub Actions에서 돌고, 실패하면 빌드를 멈춘다.
// (일본어 화면에 한글, 한국어 화면에 번역 안 된 일본어)
//
//   npm run check:i18n            화면 코드·번역표 검사 (실패하면 종료 코드 1)
//   npm run check:i18n -- --data  데이터 파일의 일본어·한국어 필드도 점검해서 알려준다 (경고만)
//
// 1) 화면 코드(src/)에서 i18n.ts 밖에 하드코딩된 한글·일본어 문구 → 실패
//    (주석, 태그 값처럼 데이터 키로 쓰는 문자열은 허용. .astro의 메타 설명은 두 언어 병기라 일본어 검사에서 뺀다)
// 2) 태그 라벨·지역 라벨·화면 문구의 일본어 번역에 한글이 있거나 빠짐, 한국어 문구에 일본어 → 실패
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { hasHangul, hasRawJapanese, JAPANESE } from "../shared/lang";
import { ATTACK_TYPES, IOC_TYPES, NATURES, REGIONS, SECTORS } from "../shared/taxonomy";
import type { Briefing, NewsItem, Topic } from "../shared/types";
import { REGION_LABELS, STRINGS, tagLabel } from "../src/i18n";

const TAXONOMY = new Set<string>([...ATTACK_TYPES, ...SECTORS, ...NATURES, ...IOC_TYPES]);
/** 데이터 키가 아닌데도 허용하는 한글 문자열 (지금은 없음. 언어 이름도 i18n.ts의 LANG_NAMES에 둔다) */
const ALLOWED = new Set<string>([]);

const problems: string[] = [];

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if ([".ts", ".tsx", ".astro"].includes(extname(e.name))) out.push(p);
  }
  return out;
}

type Hit = { line: number; text: string; inString: boolean; ja: boolean };

/** 주석을 건너뛰며 문자열 리터럴과 코드(JSX 글자 포함)에 나오는 한글·일본어를 찾는다 */
function scanCode(src: string): Hit[] {
  const hits: Hit[] = [];
  let i = 0;
  let line = 1;
  const at = (k: number) => src[k] ?? "";
  while (i < src.length) {
    const c = src[i];
    if (c === "\n") {
      line++;
      i++;
    } else if (c === "/" && at(i + 1) === "/") {
      while (i < src.length && src[i] !== "\n") i++;
    } else if (c === "/" && at(i + 1) === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && at(i + 1) === "/")) {
        if (src[i] === "\n") line++;
        i++;
      }
      i += 2;
    } else if (c === '"' || c === "'" || c === "`") {
      const startLine = line;
      let j = i + 1;
      let text = "";
      while (j < src.length && src[j] !== c) {
        if (src[j] === "\\") {
          text += src[j + 1] ?? "";
          j += 2;
          continue;
        }
        if (src[j] === "\n") {
          if (c !== "`") break; // 따옴표 문자열은 줄을 넘지 않는다 (JSX 글자 속 아포스트로피 등)
          line++;
        }
        text += src[j];
        j++;
      }
      if (hasHangul(text)) hits.push({ line: startLine, text, inString: true, ja: false });
      else if (JAPANESE.test(text)) hits.push({ line: startLine, text, inString: true, ja: true });
      i = j + 1;
    } else {
      // 코드 영역 (JSX 텍스트 포함): 한글이 나오면 그 줄 조각을 기록.
      // 단, 태그 값을 객체 키로 쓴 경우(예: `사건: tokens...`)는 데이터 키라 허용한다.
      const key = src.slice(i).match(/^([가-힣]+)\s*:/);
      if (key && TAXONOMY.has(key[1])) {
        i += key[1].length;
      } else if (hasHangul(c) || JAPANESE.test(c)) {
        let j = i;
        while (j < src.length && src[j] !== "\n" && src[j] !== "<" && src[j] !== "{") j++;
        const text = src.slice(i, j).trim();
        hits.push({ line, text, inString: false, ja: !hasHangul(text) });
        i = j;
      } else i++;
    }
  }
  return hits;
}

// 일본어가 없을 때 한국어로 대신 보여주는 코드 패턴. src/components/text.ts의 도우미(titleOf, summaryOf, namesOf)를 써야 한다.
const FALLBACK_TO_KO = /\.titleJa\s*\|\|[^\n]*titleKo|summaryJa\.length\s*\?[^\n]*summaryKo/;

async function checkSources() {
  const files = (await walk("src")).filter((f) => !f.replace(/\\/g, "/").endsWith("src/i18n.ts"));
  for (const f of files) {
    let src = await readFile(f, "utf8");
    if (!f.replace(/\\/g, "/").endsWith("components/text.ts")) {
      src.split("\n").forEach((l, i) => {
        if (FALLBACK_TO_KO.test(l))
          problems.push(
            `${relative(".", f)}:${i + 1}  일본어가 없을 때 한국어로 대신 보여주는 코드 → text.ts의 titleOf/summaryOf를 쓰세요`,
          );
      });
    }
    if (f.endsWith(".astro")) src = src.replace(/<!--[\s\S]*?-->/g, "");
    for (const h of scanCode(src)) {
      if (h.inString && (TAXONOMY.has(h.text) || ALLOWED.has(h.text))) continue;
      if (h.ja && f.endsWith(".astro")) continue;
      problems.push(
        `${relative(".", f)}:${h.line}  하드코딩된 ${h.ja ? "일본어" : "한글"} → src/i18n.ts로 옮기세요: "${h.text.slice(0, 50)}"`,
      );
    }
  }
}

function checkTranslations() {
  for (const v of TAXONOMY) {
    const ja = tagLabel("ja", v);
    if (hasHangul(ja)) problems.push(`태그 "${v}"의 일본어 라벨이 없음 (src/i18n.ts의 *_JA 표에 추가)`);
  }
  for (const r of REGIONS) if (hasHangul(REGION_LABELS.ja[r])) problems.push(`지역 "${r}"의 일본어 라벨에 한글`);

  const visit = (path: string, v: unknown) => {
    if (typeof v === "string") {
      if (hasHangul(v)) problems.push(`STRINGS.ja.${path}에 한글: "${v.slice(0, 40)}"`);
    } else if (typeof v === "function") {
      const r = (v as (...a: unknown[]) => unknown)("X", "Y");
      visit(`${path}()`, r);
    } else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) visit(`${path}.${k}`, x);
    }
  };
  for (const [k, v] of Object.entries(STRINGS.ja)) visit(k, v);

  const visitKo = (path: string, v: unknown) => {
    if (typeof v === "string") {
      if (hasRawJapanese(v)) problems.push(`STRINGS.ko.${path}에 일본어: "${v.slice(0, 40)}"`);
    } else if (typeof v === "function") {
      visitKo(`${path}()`, (v as (...a: unknown[]) => unknown)("X", "Y"));
    } else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) visitKo(`${path}.${k}`, x);
    }
  };
  for (const [k, v] of Object.entries(STRINGS.ko)) visitKo(k, v);
}

async function checkData() {
  const read = async <T>(p: string, d: T) => {
    try {
      return JSON.parse(await readFile(p, "utf8")) as T;
    } catch {
      return d;
    }
  };
  const news = await read<NewsItem[]>("public/data/news.json", []);
  const topics = await read<Topic[]>("public/data/topics.json", []);
  const briefings = await read<Briefing[]>("public/data/briefings.json", []);
  const badJa = (t: string, s: string[]) => !t || hasHangul(t) || !s.length || s.some(hasHangul);
  const badKo = (t: string, s: string[]) => hasRawJapanese(t) || s.some(hasRawJapanese);
  const report = {
    "기사 일본어": news.filter((n) => badJa(n.titleJa, n.summaryJa)).length,
    "기사 이름(조직·그룹)": news.filter((n) => [...n.entities.orgs, ...n.entities.actors].some(hasHangul)).length,
    "토픽 일본어": topics.filter((t) => badJa(t.titleJa, t.summaryJa)).length,
    "토픽 이름(조직·그룹)": topics.filter((t) => [...t.entities.orgs, ...t.entities.actors].some(hasHangul)).length,
    "브리핑 일본어": briefings
      .flatMap((b) => [b.headlineJa, ...b.items.flatMap((i) => [i.titleJa, i.bodyJa, i.whyJa])])
      .filter((x) => !x || hasHangul(x)).length,
    "기사 한국어": news.filter((n) => badKo(n.titleKo, n.summaryKo)).length,
    "토픽 한국어": topics.filter((t) => badKo(t.titleKo, t.summaryKo)).length,
    "브리핑 한국어": briefings
      .flatMap((b) => [b.headlineKo, ...b.items.flatMap((i) => [i.titleKo, i.bodyKo, i.whyKo])])
      .filter(hasRawJapanese).length,
  };
  console.log("데이터 점검 (경고, 다음 수집의 언어 점검 단계가 고친다):");
  for (const [k, v] of Object.entries(report)) console.log(`  ${v ? "!" : "✓"} ${k}: ${v}`);
}

await checkSources();
checkTranslations();
if (process.argv.includes("--data")) await checkData();

if (problems.length) {
  console.error(`언어 섞임 검사 실패 (${problems.length}건):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log("언어 섞임 검사 통과: 화면 코드와 번역표에 다른 언어가 섞이지 않음");
