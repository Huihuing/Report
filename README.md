# Report

SKT New Deal · ALEPH Studio 과제와 실습 결과물을 관리하는 저장소입니다.

## 배포 구조

Vercel은 `report` 프로젝트 하나만 사용합니다.

- T01: https://report-huihuing.vercel.app/
- T02: https://report-huihuing.vercel.app/t02/
- T03: https://report-huihuing.vercel.app/t03/
- T04: https://report-huihuing.vercel.app/t04/
- T05: https://report-huihuing.vercel.app/t05/
- T06: https://report-huihuing.vercel.app/t06/
- 이후 과제: `/t03/`, `/t04/`처럼 같은 도메인 아래 추가

세부 운영 규칙은 `AGENTS.md`를 따릅니다.

## T01 — 나를 소개하는 한 페이지

이력서 양식을 복제하기보다, 공개 범위를 직접 정하고 개발 관심사와 프로젝트 경험을 한 화면에서 소개하는 정적 웹페이지입니다.

### 구성

- `index.html` — T01 결과물 + ALEPH 과제 허브
- `styles.css` — 반응형 화면 및 접근성 스타일
- `script.js` — 테마 전환과 프로젝트 필터
- `docs/T01-SCOPE.md` — 공개/비공개 범위 점검표
- `docs/T01-SUBMISSION.md` — 제출용 확인 방법과 AI/본인 판단 기록

## T02 — Gate Sprint 30

30초 안에 목표 색과 같은 좌우 문을 선택해 8개의 관문을 통과하는 브라우저 미니게임입니다.

- `t02/index.html`
- `t02/styles.css`
- `t02/script.js`
- `docs/T02-EVIDENCE.md` — PC 경계·난이도·저장·효과 검사 기록
- `docs/T02-SUBMISSION.md` — 제출용 4줄/3줄 및 최종 확인 목록

## 로컬 실행

별도 빌드가 필요하지 않습니다. 저장소를 내려받은 뒤 루트 `index.html` 또는 각 과제 폴더의 `index.html`을 브라우저에서 열면 됩니다.


## T03 — 짤·카드 스튜디오

PNG·JPEG 이미지를 불러와 한글 문구의 위치·크기·색을 즉시 미리보기에 반영하는 브라우저 편집기입니다.

- `t03/index.html`
- `t03/styles.css`
- `t03/script.js`
- `docs/T03-EVIDENCE.md` — 화면비·극단 입력·JSON·공개 안전 검사 기록
- `docs/T03-SUBMISSION.md` — 제출용 4줄/3줄 초안
- 공개 주소: https://report-huihuing.vercel.app/t03/


## T04 — 오늘의 진짜 정보판

Open-Meteo의 공개 서울 2m 기온을 실제로 조회하고, 합성 fixture로 timeout·401/403·rate limit·offline·schema change를 재생합니다.

- `t04/index.html`
- `t04/styles.css`
- `t04/script.js`
- `api/t04-live.js` — 비밀키 없는 서버 경로
- `t04/data/live-history.json` — 실제 KST 날짜별 보존 기록
- `docs/T04-EVIDENCE.md` — package/hash·실패 재생·실제 날짜 기록
- `docs/T04-SUBMISSION.md` — 제출용 4줄/3줄 및 미완료 날짜 안내
- 공개 주소: https://report-huihuing.vercel.app/t04/


## T06 — 플랜두씨 다이어리 1

실제 ALEPH 진행 계획을 Plan → Do → See로 연결하고 서버 PostgreSQL 데이터베이스에 저장하는 무로그인 공개 다이어리입니다.

- `t06/index.html` — 공개 UI
- `t06/styles.css`
- `t06/script.js` — CRUD·검색·필터·정렬·집계·JSON 내보내기
- `t06/schema.sql` — DB 테이블·제약·중복 완료 방지 함수
- `contracts/pds-schema-v2.json` — 최종 데이터 계약과 날짜 규칙
- `supabase/functions/t06-pds/index.ts` — 브라우저와 DB 사이 공개 Edge Function
- 공개 주소: https://report-huihuing.vercel.app/t06/

T06는 아직 로그인 기능이 없으므로 공개해도 괜찮은 ALEPH 진행 기록만 저장합니다.

## T07 — 플랜두씨 다이어리 2 (인증)

- 첫 화면: https://report-huihuing.vercel.app/t07/
- T06 소스 고정: `bb0352766c2b3974b074c3ec2db261679b49f7a7`
- 인증: Supabase Auth `supabase-js@2.95.0`(bcrypt), Edge Function 서버 세션(60분)
- 데이터: `t07_*` owner_id 기반 PostgreSQL, 직접 Data API 권한 폐쇄
- T06 공개 자료 API: T07로 이전을 위해 410 Gone; 기존 실제 자료는 1회 이전 보관함에 잠겨 있음
- 로그인 후 이전 코드로 T06 계획/할 일/실행/돌아보기 자료를 본인 계정으로 가져올 수 있음
- 5일간 실제 KST 날짜의 사용 기록을 쌓고 2일차 뒤·3일차 전에 계획 규칙 하나만 변경
- 자료 전체 JSON 내보내기, 비밀번호 변경(세션 전부 종료), 계정 및 연결 자료 삭제
- 인증 설명서: `docs/T07-AUTH.md`
- 제출 현황과 부족한 검증: `docs/T07-SUBMISSION.md`
- 데이터 계약: `contracts/pds-auth-schema-v3.json`

T07 제출에서 **5일차 기록은 실제 날짜에만 작성할 수 있으므로 당일 모두 완료했다고 주장하지 않습니다.**
