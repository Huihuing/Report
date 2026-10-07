# Report

SKT New Deal · ALEPH Studio 과제와 실습 결과물을 관리하는 저장소입니다.

## 배포 구조

Vercel은 `report` 프로젝트 하나만 사용합니다.

- T01: https://report-huihuing.vercel.app/
- T02: https://report-huihuing.vercel.app/t02/
- T03: https://report-huihuing.vercel.app/t03/
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
