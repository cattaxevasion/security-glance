// 방문자 수 (Cloudflare Worker + Durable Object).
// 사이트를 열 때마다 POST /hit로 1을 더하고 오늘·누적을 돌려준다. GET /stats는 더하지 않고 읽기만 한다 (로컬 미리보기용).
// 날짜별 숫자만 저장한다: 쿠키·IP·브라우저 정보는 남기지 않는다. '오늘'은 일본 시간 기준.
import { DurableObject } from "cloudflare:workers";

interface Env {
  COUNTER: DurableObjectNamespace<Counter>;
  /** 쉼표로 나눈 허용 출처 (사이트 주소, 로컬 미리보기) */
  ALLOWED_ORIGINS: string;
}

export interface Visits {
  today: number;
  total: number;
}

/** 일본 시간 날짜 (YYYY-MM-DD) */
export function jstDay(now = Date.now()): string {
  return new Date(now + 9 * 3600_000).toISOString().slice(0, 10);
}

export class Counter extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS daily (day TEXT PRIMARY KEY, n INTEGER NOT NULL)");
  }

  hit(day: string): Visits {
    this.ctx.storage.sql.exec(
      "INSERT INTO daily (day, n) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET n = n + 1",
      day,
    );
    return this.stats(day);
  }

  stats(day: string): Visits {
    const sql = this.ctx.storage.sql;
    const today = sql.exec<{ n: number }>("SELECT n FROM daily WHERE day = ?", day).toArray()[0]?.n ?? 0;
    const total = sql.exec<{ n: number | null }>("SELECT SUM(n) AS n FROM daily").one().n ?? 0;
    return { today, total };
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get("Origin") ?? "";
    const allowed = env.ALLOWED_ORIGINS.split(",").map((x) => x.trim());
    // 사이트에서 부른 것만 받는다 (주소창·봇이 직접 부르면 세지 않는다)
    if (!allowed.includes(origin)) return new Response("forbidden", { status: 403 });
    const headers = {
      "Access-Control-Allow-Origin": origin,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Vary: "Origin",
    };
    const { pathname } = new URL(req.url);
    const counter = env.COUNTER.get(env.COUNTER.idFromName("site"));
    const day = jstDay();
    if (req.method === "POST" && pathname === "/hit") return Response.json(await counter.hit(day), { headers });
    if (req.method === "GET" && pathname === "/stats") return Response.json(await counter.stats(day), { headers });
    return new Response("not found", { status: 404, headers });
  },
} satisfies ExportedHandler<Env>;
