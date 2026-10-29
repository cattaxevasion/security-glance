// 화면 언어가 섞이지 않게 막는 검사. 배포 전에 GitHub Actions에서 돌고, 실패하면 빌드를 멈춘다.
// (일본어 화면에 한글, 한국어 화면에 번역 안 된 일본어, 영어 화면에 한글·가나·한자)
//
//   npm run check:i18n            화면 코드·번역표 검사 (실패하면 종료 코드 1)
//   npm run check:i18n -- --data  화면이 받는 데이터 파일도 검사 (섞임이 하나라도 있으면 실패 → 배포 중단)
//
// 1) 화면 코드(src/)에서 i18n.ts 밖에 하드코딩된 한글·일본어 문구 → 실패
//    (주석, 태그 값처럼 데이터 키로 쓰는 문자열은 허용. .astro의 메타 설명은 두 언어 병기라 일본어 검사에서 뺀다)
// 2) 태그 라벨·지역 라벨·화면 문구의 일본어 번역에 한글이 있거나 빠짐, 한국어 문구에 일본어 → 실패
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { hasHangul, hasNonEnglish, hasRawJapanese, JAPANESE } from "../shared/lang";
import { ATTACK_TYPES, IOC_TYPES, NATURES, REGIONS, SECTORS } from "../shared/taxonomy";
import type { ArticleRef, Briefing, Topic } from "../shared/types";
import { REGION_LABELS, SOURCE_LABELS, STRINGS, tagLabel } from "../src/i18n";

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

// 언어별 필드를 화면 코드에서 직접 고르는 패턴. src/components/text.ts의 도우미(titleOf, summaryOf, textOf, namesOf)를 써야
// 마지막 안전장치(섞인 글자 정리)를 거친다.
const FALLBACK_TO_KO =
  /\.title(Ja|En)\s*\|\|[^\n]*title(Ko|Ja)|summary(Ja|En)\.length\s*\?[^\n]*summary(Ko|Ja)|\b(lang|L)\s*===\s*"(ja|ko|en)"\s*\?[^\n:]*(Ja|Ko|En)\s*:/;

async function checkSources() {
  const files = (await walk("src")).filter((f) => !f.replace(/\\/g, "/").endsWith("src/i18n.ts"));
  for (const f of files) {
    let src = await readFile(f, "utf8");
    if (!f.replace(/\\/g, "/").endsWith("components/text.ts")) {
      src.split("\n").forEach((l, i) => {
        if (FALLBACK_TO_KO.test(l))
          problems.push(
            `${relative(".", f)}:${i + 1}  언어별 필드를 직접 고르는 코드 → text.ts의 titleOf/summaryOf/textOf를 쓰세요`,
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

/**
 * 화면이 실제로 받는 데이터 파일 검사. 수집기의 언어 점검과 마지막 확인을 거쳤으므로 0이어야 한다.
 * 하나라도 걸리면 그 장치가 고장 난 것이라 배포를 멈춘다 (섞인 화면을 내보내는 대신).
 */
async function checkData() {
  const read = async <T>(p: string, d: T) => {
    try {
      return JSON.parse(await readFile(p, "utf8")) as T;
    } catch {
      return d;
    }
  };
  // 화면용으로 나눈 토픽 파일이 있으면 그것을, 없으면(오래된 로컬 데이터) 전체본을 본다
  const recent = await read<Topic[] | null>("public/data/topics-recent.json", null);
  const topics = recent
    ? [...recent, ...(await read<Topic[]>("public/data/topics-archive.json", []))]
    : await read<Topic[]>("public/data/topics.json", []);
  const articles = await read<ArticleRef[]>("public/data/articles.json", []);
  const briefings = await read<Briefing[]>("public/data/briefings.json", []);
  const readings = await read<Record<string, string>>("public/data/names-ko.json", {});
  const english = await read<Record<string, string>>("public/data/names-en.json", {});

  const leaks: [string, string][] = [];
  const ja = (where: string, x: string) => hasHangul(x) && leaks.push([`${where} 일본어에 한글`, x]);
  const ko = (where: string, x: string) => hasRawJapanese(x) && leaks.push([`${where} 한국어에 일본어`, x]);
  // 영어: 비어 있는 것은 섞임이 아니다 (채우는 중, 화면은 안내 문구). 아래에서 수만 알린다
  let emptyEn = 0;
  const en = (where: string, x: string | undefined) => {
    if (!x) emptyEn++;
    else if (hasNonEnglish(x)) leaks.push([`${where} 영어에 한글·일본어`, x]);
  };
  for (const a of articles) {
    ja("기사 제목", a.titleJa);
    ko("기사 제목", a.titleKo);
    en("기사 제목", a.titleEn);
  }
  for (const t of topics) {
    ja("토픽 제목", t.titleJa);
    ko("토픽 제목", t.titleKo);
    en("토픽 제목", t.titleEn);
    t.summaryJa.forEach((x) => ja("토픽 요약", x));
    t.summaryKo.forEach((x) => ko("토픽 요약", x));
    (t.summaryEn ?? []).forEach((x) => en("토픽 요약", x));
  }
  for (const b of briefings) {
    [b.headlineJa, ...b.items.flatMap((i) => [i.titleJa, i.bodyJa, i.whyJa])].forEach((x) => ja("브리핑", x));
    [b.headlineKo, ...b.items.flatMap((i) => [i.titleKo, i.bodyKo, i.whyKo])].forEach((x) => ko("브리핑", x));
    [b.headlineEn, ...b.items.flatMap((i) => [i.titleEn, i.bodyEn, i.whyEn])].forEach((x) => en("브리핑", x));
  }
  // 데이터 무결성: 토픽 id가 겹치면 하나를 누를 때 여러 개가 선택되고 엉뚱한 토픽이 열린다
  const idCount = new Map<string, number>();
  for (const t of topics) idCount.set(t.id, (idCount.get(t.id) ?? 0) + 1);
  for (const [id, n] of idCount) if (n > 1) problems.push(`[데이터] 토픽 id ${id}가 ${n}개 토픽에 겹침`);

  for (const [name, r] of Object.entries(readings))
    if (!hasHangul(r) || JAPANESE.test(r)) leaks.push(["이름 한국어 읽기가 한글이 아님", `${name} → ${r}`]);
  for (const [name, r] of Object.entries(english))
    if (!r || hasNonEnglish(r)) leaks.push(["이름 영어 표기에 영어가 아닌 글자", `${name} → ${r}`]);

  // 화면이 숨기는 것(경고만): 한글로 적힌 이름은 일본어 화면에서, 읽기가 없는 일본어 이름은 한국어 화면에서 빠진다
  const names = [...new Set(topics.flatMap((t) => [...t.entities.orgs, ...t.entities.actors]))];
  const hiddenJa = names.filter(hasHangul).length;
  const hiddenKo = names.filter((n) => hasRawJapanese(n) && !readings[n]).length;
  const hiddenEn = names.filter((n) => hasNonEnglish(n) && !english[n]).length;

  console.log(
    `데이터 점검: 기사 ${articles.length} · 토픽 ${topics.length} · 브리핑 ${briefings.length} · 이름 읽기 ${Object.keys(readings).length}`,
  );
  if (hiddenJa || hiddenKo || hiddenEn)
    console.log(
      `  (경고) 화면에서 숨기는 이름: 일본어 화면 ${hiddenJa}개 · 한국어 화면 ${hiddenKo}개 · 영어 화면 ${hiddenEn}개`,
    );
  if (emptyEn) console.log(`  (알림) 아직 비어 있는 영어 ${emptyEn}칸 (채우는 중, 화면은 안내 문구)`);
  for (const [k, x] of leaks.slice(0, 30)) problems.push(`[데이터] ${k}: "${x.slice(0, 50)}"`);
  if (leaks.length > 30) problems.push(`[데이터] … 외 ${leaks.length - 30}건`);
}

/** 매체 이름이 화면 언어와 다른 글자를 쓰면 src/i18n.ts의 SOURCE_LABELS에 표기가 있어야 한다 */
async function checkSourceLabels() {
  const { sources } = JSON.parse(await readFile("sources.json", "utf8")) as { sources: { name: string }[] };
  for (const { name } of sources) {
    const ko = SOURCE_LABELS.ko[name];
    const ja = SOURCE_LABELS.ja[name];
    if (hasRawJapanese(name) && (!ko || hasRawJapanese(ko)))
      problems.push(`매체 "${name}"의 한국어 표기가 없음 (src/i18n.ts의 SOURCE_LABELS.ko에 추가)`);
    if (hasHangul(name) && (!ja || hasHangul(ja)))
      problems.push(`매체 "${name}"의 일본어 표기가 없음 (src/i18n.ts의 SOURCE_LABELS.ja에 추가)`);
  }
}

await checkSources();
checkTranslations();
await checkSourceLabels();
if (process.argv.includes("--data")) await checkData();

if (problems.length) {
  console.error(`언어 섞임 검사 실패 (${problems.length}건):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log("언어 섞임 검사 통과: 화면 코드와 번역표에 다른 언어가 섞이지 않음");
