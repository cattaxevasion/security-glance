import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const USER_AGENT =
  "Mozilla/5.0 (compatible; security-glance/0.1; personal security news digest)";

/** 한 번에 받는 응답의 최대 크기. 비정상적으로 큰 페이지가 수집을 멈추거나 메모리를 다 쓰지 않게 */
export const MAX_PAGE_BYTES = 5 * 1024 * 1024;
/** 피드는 본문 전체를 수백 건씩 싣는 곳(Elastic 등)이 있어 더 넉넉하게 */
export const MAX_FEED_BYTES = 30 * 1024 * 1024;

export async function fetchText(url: string, timeoutMs = 15000, maxBytes = MAX_PAGE_BYTES): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (Number(res.headers.get("content-length") ?? 0) > maxBytes) {
    await res.body?.cancel();
    throw new Error(`응답이 너무 큼 (${res.headers.get("content-length")} bytes)`);
  }
  if (!res.body) return "";
  // 크기를 알려주지 않는 응답도 읽으면서 센다
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error(`응답이 너무 큼 (${maxBytes} bytes 넘음)`);
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export async function fetchJson<T>(url: string, init: RequestInit = {}, timeoutMs = 30000): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": USER_AGENT, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json() as Promise<T>;
}

/**
 * 추적용 쿼리(utm_* 등)와 해시를 지운 URL. 중복 판정 기준.
 * http·https가 아닌 주소(javascript:, data: 등)나 잘못된 주소는 빈 문자열 → 수집하지 않는다.
 */
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|ref$|from$)/i.test(key)) u.searchParams.delete(key);
    }
    return u.toString();
  } catch {
    return "";
  }
}

export function idFor(url: string): string {
  return sha1(normalizeUrl(url));
}

/** 짧은 id (sha1 앞 16자리) */
export function sha1(s: string): string {
  return createHash("sha1").update(s).digest("hex").slice(0, 16);
}

export function cleanText(s: string | undefined | null): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

export async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  // 들여쓰기 없이 쓴다 (화면이 받는 파일 크기가 절반 가까이 준다). 사람이 볼 때는 jq 등으로 펼쳐 보기.
  await writeFile(path, JSON.stringify(data) + "\n", "utf8");
}

/** 동시에 최대 limit개씩 처리. 결과 순서는 입력 순서와 같다. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
