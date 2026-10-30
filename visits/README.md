# 방문자 수 (Cloudflare Worker)

사이트를 열 때마다 1을 더하고 오늘(일본 시간)·누적 방문 수를 돌려준다. 데스크톱 화면 왼쪽 메뉴 맨 아래에 `방문자 · 오늘 · 누적`으로 보인다.

- 숫자는 Durable Object 하나(SQLite)에 날짜별로만 저장한다. 쿠키·IP·브라우저 정보는 남기지 않는다.
- `POST /hit`: 1을 더하고 `{ today, total }`. `GET /stats`: 더하지 않고 읽기만 (로컬 미리보기).
- 사이트 주소(`ALLOWED_ORIGINS`)에서 부른 요청만 받는다. 주소창·봇이 직접 부르면 403.
- 사이트 쪽 주소는 `src/components/visitors.ts`의 `VISITS_URL`. 비어 있으면 세지도 보여주지도 않는다.

## 처음 설정

```bash
npm install
npx wrangler login
npx wrangler deploy                     # 끝에 나오는 https://security-glance-visits.<계정>.workers.dev 주소를 VISITS_URL에
```

따로 만들 저장소(KV·D1)는 없다. Durable Object는 deploy가 같이 만든다.

## 확인

```bash
npx wrangler tail                       # 실시간 로그
```

로컬 시험: `npx wrangler dev --local --port 8799` 후 `curl -X POST -H "Origin: http://localhost:4321" localhost:8799/hit`.
