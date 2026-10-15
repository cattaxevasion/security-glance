# Security Glance

국제 · 일본 · 한국 보안 이슈를 AI 요약(한국어·일본어)과 태그로 한눈에 보는 개인 대시보드. 기획은 [PLAN.md](PLAN.md)에 있다.

사이트: https://cattaxevasion.github.io/security-glance/

## 로컬 실행

```bash
npm install
npm run dev          # http://localhost:4321
```

### 데이터 수집

```bash
npm run collect              # 뉴스 + 취약점
npm run collect -- vulns     # 취약점만 (API 키 불필요)
npm run collect -- news --limit 10 --dry   # 새 기사 10건만 요약해서 출력 (저장 안 함)
```

| 환경변수 | 필수 | 설명 |
|---|---|---|
| `ANTHROPIC_API_KEY` | 기사 요약에 필요 | 없으면 요약을 건너뛰고 취약점만 갱신 |
| `ANTHROPIC_WORKSPACE_ID` | 조건부 | 워크스페이스에 묶이지 않은 키를 쓸 때 필요 (`wrkspc_...`) |
| `NVD_API_KEY` | 선택 | 없으면 NVD 요청을 천천히 보낸다 |
| `SUMMARY_MODEL` | 선택 | 기본 `claude-haiku-5-5` |
| `MAX_NEW_PER_RUN` | 선택 | 한 번에 요약할 새 기사 수, 기본 80 |

### 개발용 도구 (`scripts/dev/`)

- `probe-feeds.ts <url...>`: RSS 주소가 파싱되는지 확인
- `probe-extract.ts`: 소스마다 본문 추출이 되는지 확인

## 소스 추가

`sources.json`에 한 줄 추가한다. `region`은 출처 지역(INTL/JP/KR), 일반 IT 매체면 `"keywordFilter": true`로 보안 기사만 거른다.

행사·홍보·인사 기사를 거르는 제목 키워드는 `scripts/collect/filter.ts`, 태그 목록은 `shared/taxonomy.ts`, 화면 번역은 `src/i18n.ts`에 있다.

## 배포 (GitHub Pages)

1. GitHub에 저장소를 만들고 push
2. Settings → Secrets and variables → Actions에 `ANTHROPIC_API_KEY` 등록 (워크스페이스에 묶이지 않은 키면 `ANTHROPIC_WORKSPACE_ID`도, 선택: `NVD_API_KEY`)
3. Settings → Pages → Source를 **GitHub Actions**로 설정
4. Actions 탭에서 `Collect & Deploy` 워크플로를 수동 실행 (이후 6시간마다 자동)

## 구조

```
sources.json            RSS 소스 목록
shared/                 태그 체계, 데이터 타입 (수집기와 화면이 같이 씀)
scripts/collect/        수집기: rss → article(본문) → summarize(Claude) / vulns(KEV·NVD·EPSS)
public/data/            화면이 읽는 JSON (Actions가 갱신해서 커밋)
data/state.json         내부 상태 (보안 무관 판정, 실패 횟수)
src/components/         Fluent 2 화면 (React): AppHeader, AppNav, NewsPage, VulnPage, DetailPanel
src/i18n.ts             한/日 화면 글자와 태그 라벨
```

기사 저작권은 각 언론사와 기관에 있다. 이 사이트는 제목, 링크, AI 요약만 보여준다.
