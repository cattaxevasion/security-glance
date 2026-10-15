# Security Glance

일본 · 국제 보안 이슈를 뉴스와 보안 벤더 리서치에서 모아, 같은 사건끼리 묶어 정리(まとめ)하고 매일 아침 브리핑을 만드는 개인 대시보드. 요약은 한국어·일본어. 기획은 [PLAN.md](PLAN.md)에 있다.

사이트: https://cattaxevasion.github.io/security-glance/

## 로컬 실행

```bash
npm install
npm run data:pull    # data 브랜치에서 최신 수집 데이터 받기 (public/data, data/)
npm run dev          # http://localhost:4321
```

수집 데이터는 main이 아니라 **`data` 브랜치**에 있다. GitHub Actions가 실행마다 커밋 하나로 덮어쓰므로(force push) main 기록과 저장소 크기가 깨끗하게 유지된다.

### 데이터 수집

```bash
npm run collect              # 뉴스 + 취약점
npm run collect -- vulns     # 취약점만 (API 키 불필요)
npm run collect -- news --limit 10 --dry   # 새 기사 10건만 요약해서 출력 (저장 안 함)
npm run collect -- --briefing              # 오늘의 브리핑을 시각과 상관없이 다시 만들기
```

| 환경변수 | 필수 | 설명 |
|---|---|---|
| `ANTHROPIC_API_KEY` | 기사 요약에 필요 | 없으면 요약을 건너뛰고 취약점만 갱신 |
| `ANTHROPIC_WORKSPACE_ID` | 조건부 | 워크스페이스에 묶이지 않은 키를 쓸 때 필요 (`wrkspc_...`) |
| `NVD_API_KEY` | 선택 | 없으면 NVD 요청을 천천히 보낸다 |
| `SUMMARY_MODEL` | 선택 | 기본 `claude-haiku-5-5` |
| `MAX_NEW_PER_RUN` | 선택 | 한 번에 요약할 새 기사 수, 기본 80 |
| `BRIEFING_MODEL` | 선택 | 브리핑에 쓸 모델, 기본은 `SUMMARY_MODEL`과 같음 |

### 한글 누출 검사

```bash
npm run check:i18n              # 화면 코드·번역표 검사 (배포 전에 Actions에서도 실행, 실패하면 빌드 중단)
npm run check:i18n -- --data    # 데이터 파일의 일본어 필드도 점검 (경고만)
```

- 화면 문구는 반드시 `src/i18n.ts`에 둔다. 컴포넌트에 한글을 직접 쓰면 검사가 실패한다 (주석·태그 값은 예외).
- 일본어 화면용 글은 `src/components/text.ts`의 `titleOf` / `summaryOf` / `namesOf`로 고른다.
- 데이터 쪽은 수집기의 언어 점검(`scripts/collect/lang-audit.ts`)이 매번 고친다.

### 개발용 도구 (`scripts/dev/`)

- `probe-feeds.ts <url...>`: RSS 주소가 파싱되는지 확인
- `probe-extract.ts`: 소스마다 본문 추출이 되는지 확인

## 소스 추가

`sources.json`에 한 줄 추가한다. `region`은 출처 지역(INTL/JP), `kind`는 news(매체) / vendor(벤더 리서치, 본문을 길게 읽고 ATT&CK·IoC를 뽑음) / cert(CERT·기관), 일반 IT 매체면 `"keywordFilter": true`로 보안 기사만 거른다.

행사·홍보·인사 기사를 거르는 제목 키워드는 `scripts/collect/filter.ts`, 태그 목록은 `shared/taxonomy.ts`, 화면 번역은 `src/i18n.ts`에 있다.

## 배포 (GitHub Pages)

1. GitHub에 저장소를 만들고 push
2. Settings → Secrets and variables → Actions에 `ANTHROPIC_API_KEY` 등록 (워크스페이스에 묶이지 않은 키면 `ANTHROPIC_WORKSPACE_ID`도, 선택: `NVD_API_KEY`)
3. Settings → Pages → Source를 **GitHub Actions**로 설정
4. Actions 탭에서 `Collect & Deploy` 워크플로를 수동 실행 (이후 6시간마다 자동, 일본 시간 06:17 실행에서 브리핑 생성)

## 구조

```
sources.json            RSS 소스 목록
shared/                 태그 체계, 데이터 타입 (수집기와 화면이 같이 씀)
scripts/collect/        수집기: rss → article(본문) → summarize(Claude) / vulns(KEV·NVD·EPSS)
                        → topics(묶기·통합 요약·중요도) → briefing(오늘의 브리핑)
public/data/            화면이 읽는 JSON (data 브랜치에서 받음, git 추적 안 함)
                        articles.json(화면용 가벼운 기사 목록), news.json(수집기 내부용, 사이트엔 안 올림)
data/                   내부 상태: state.json(제외·실패·다시 판정 기록), merge-checked.json(토픽 합치기 기록)
scripts/collect/quality.ts  품질 점검: 일반 해설·홍보 글 다시 판정, 본문 다시 읽기
src/components/         Fluent 2 화면 (React): AppHeader, AppNav, BriefingPage, IncidentsPage, TopicsPage, VulnPage, DetailPanel
                        motion.ts(Fluent 모션 토큰 기반 애니메이션)
src/i18n.ts             한/日 화면 글자와 태그 라벨
```

기사 저작권은 각 언론사와 기관에 있다. 이 사이트는 제목, 링크, AI 요약만 보여준다.
