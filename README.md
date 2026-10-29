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
| `FIX_MODEL` | 선택 | 언어 섞임이 기본 모델로 두 번 고쳐도 남을 때 쓰는 모델, 기본 `claude-sonnet-5-5` |

### 언어 섞임 검사

```bash
npm run check:i18n              # 화면 코드·번역표 검사 (배포 전에 Actions에서도 실행, 실패하면 빌드 중단)
npm run check:i18n -- --data    # 화면이 받는 데이터 파일도 검사 (하나라도 섞이면 실패)
```

- 화면 문구는 반드시 `src/i18n.ts`에 둔다. 컴포넌트에 한글·일본어를 직접 쓰면 검사가 실패한다 (주석·태그 값은 예외).
- 일본어 화면용 글은 `src/components/text.ts`의 `titleOf` / `summaryOf` / `namesOf`로 고른다.
- 데이터 쪽은 수집기의 언어 점검(`scripts/collect/lang-audit.ts`)이 같은 실행 안에서 고치고 확인한 뒤 반영한다.
  일본어 칸의 한글은 다시 번역하고, 한국어 칸에 남은 일본어는 「다이이치생명(第一生命保険)」처럼 한글 읽기 + 괄호 원문으로 고쳐 쓴다.
  고치는 순서: 기본 모델 → 남은 부분을 짚어 주고 다시 → 더 강한 모델(`FIX_MODEL`, 기본 claude-sonnet-5-5) → 그래도 남으면 기계 변환(가나 → 한글 소리).
  화면용 파일을 쓰기 직전에 한 번 더 확인하고, 배포 전 `check:i18n -- --data`가 하나라도 찾으면 배포를 멈춘다.
- 영어 칸(titleEn·summaryEn, 브리핑 *En)에는 한글·가나·한자·전각 기호를 한 글자도 두지 않는다 (괄호 속 원문도 쓰지 않음).
  일본 고유명사는 공식 영문 표기, 없으면 헵번식 로마자 (예: 第一生命保険 → Dai-ichi Life Insurance). 고치는 순서는 위와 같고, 마지막 수단은 가나 → 로마자.
  영어를 넣기 전의 기사·토픽은 저장·배포까지 가는 실행마다 최신 순으로 한도만큼(기사 150 · 토픽 100) 채운다. 비어 있는 동안 영어 화면은 안내 문구를 보여준다.
- 일본어로 적힌 조직·위협 그룹 이름은 `names-ko.json`(한국어 읽기 사전)으로 한국어 화면에 「다이이치생명보험」처럼, `names-en.json`(영어 표기 사전)으로 영어 화면에 「Dai-ichi Life Insurance」처럼 보인다.
  모델이 계속 틀리는 이름은 `scripts/collect/lang-audit.ts`의 `KNOWN_NAMES`에 고정 표기를 둔다.
  매체 이름의 화면 표기는 `src/i18n.ts`의 `SOURCE_LABELS` (새 매체를 넣을 때 빠지면 검사가 실패한다).
- 판별식·기계 변환 테스트: `npm test`

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
                        articles.json(화면용 가벼운 기사 목록), topics-recent.json(최근 31일 토픽, 첫 화면)
                        topics-archive.json(그 이전 토픽, 화면이 뜬 뒤에 받음)
                        vulns-core.json(KEV·EPSS, 첫 화면) · cves.json(고위험 CVE, 나중에 받음)
                        leaks.json(랜섬웨어 유출 사이트 게시·일본, ransomware.live 집계 — 공격 조직의 주장)
                        names-ko.json(일본어 이름의 한국어 읽기) · names-en.json(일본어 이름의 영어 표기)
                        news.json·topics.json·vulns.json(수집기 내부용 전체본, 사이트엔 안 올림)
src/pages/t/[id].astro  토픽 공유 페이지 (링크 미리보기에 토픽 제목·요약, 열면 사이트의 그 토픽으로). 일본어는 /ja/t/[id]/
data/                   내부 상태: state.json(제외·실패·다시 판정 기록), merge-checked.json(토픽 합치기 기록),
                        lang-forced.json(기계 변환한 필드의 원래 글 — 다음 실행에서 모델로 다시 고침)
scripts/collect/quality.ts  품질 점검: 일반 해설·홍보 글 다시 판정, 본문 다시 읽기
src/components/         Fluent 2 화면 (React): AppHeader, AppNav, BriefingPage, IncidentsPage, TopicsPage, VulnPage, DetailPanel
                        motion.ts(Fluent 모션 토큰 기반 애니메이션)
src/i18n.ts             한/日 화면 글자와 태그 라벨
```

기사 저작권은 각 언론사와 기관에 있다. 이 사이트는 제목, 링크, AI 요약만 보여준다.
