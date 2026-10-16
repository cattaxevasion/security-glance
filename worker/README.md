# 속보 감시 (Cloudflare Worker)

1분마다 매체·CERT 피드(벤더 리서치 제외)를 보고, 처음 보는 보안 기사가 있으면 GitHub 수집기(`update.yml`)를 바로 실행시킨다.
요약·AI는 하지 않는다. 처리는 GitHub 수집기 한 곳에서만 한다.

- 확인한 기사: KV `SEEN`의 `seen` 키 (짧은 해시, 최근 5,000건). 새 기사가 있을 때만 쓴다.
- 실행 요청이 실패하면 기억하지 않고 다음 1분에 다시 시도한다.
- 키워드 필터는 수집기와 같은 것을 쓴다 (`shared/keywords.ts`, `scripts/collect/filter.ts`).

## 처음 설정

```bash
npm install
npx wrangler login
npx wrangler kv namespace create SEEN   # 나온 id를 wrangler.jsonc의 KV_ID 자리에
npx wrangler deploy
npx wrangler secret put GITHUB_TOKEN    # 이 저장소의 Actions: Read and write만 가진 fine-grained 토큰
```

## 확인

```bash
npx wrangler tail                       # 실시간 로그
```

로컬 시험: `npx wrangler dev --test-scheduled` 후 `http://localhost:8787/__scheduled` 호출.

토큰은 만료일이 있다. 만료되면 로그에 `HTTP 401`이 찍히고 수집기는 30분 주기로만 돈다. 새 토큰으로 `secret put`을 다시 하면 된다.
