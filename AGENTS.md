# AGENTS.md

## 저장소 목적

이 저장소는 ALEPH Studio 과제 결과물을 한곳에서 관리합니다.

- T01 결과물은 저장소 루트(`/`)에 둡니다.
- T02부터는 과제 번호별 하위 폴더를 사용합니다.
  - `/t02/`
  - `/t03/`
  - `/t04/`
  - 이후도 같은 규칙을 따릅니다.
- 새 과제를 추가하면 루트 T01 페이지의 "ALEPH 과제" 영역에서도 해당 과제로 이동할 수 있게 링크를 추가합니다.

## Vercel 배포 원칙

Vercel 프로젝트는 반드시 기존 `report` 하나만 사용합니다.

- production base URL: `https://report-huihuing.vercel.app/`
- T01: `https://report-huihuing.vercel.app/`
- T02: `https://report-huihuing.vercel.app/t02/`
- T03: `https://report-huihuing.vercel.app/t03/`
- T04: `https://report-huihuing.vercel.app/t04/`
- T05: `https://report-huihuing.vercel.app/t05/`
- T06: `https://report-huihuing.vercel.app/t06/`
- 이후 과제도 같은 도메인 아래 하위 경로로 배포합니다.
- 과제별로 별도 Vercel 프로젝트를 새로 만들지 않습니다.
- 별도 Vercel 프로젝트가 이미 존재하더라도 제출 URL에는 사용하지 않습니다.
- Vercel Authentication, Password Protection 등 로그인 또는 권한 요구 설정을 켜지 않습니다.
- 배포 후 공개 URL이 무로그인 상태에서 HTTP 200으로 열리는지 확인합니다.

## GitHub/제출 원칙

- 소스는 `Huihuing/Report` 저장소 하나에서 관리합니다.
- 제출용 소스 URL은 브랜치/저장소 첫 화면이 아니라 해당 제출 시점의 full commit URL을 사용합니다.
- full commit SHA는 40자리 소문자 SHA를 그대로 사용합니다.
- 새 작업으로 커밋이 추가되면 제출 직전 최신 full commit URL을 다시 확인합니다.

## 과제 카드 처리 원칙

- 사용자가 과제 안내 카드 전체를 제공하면 일부 카드만 기준으로 판단하지 않고 전체 통과 기준을 먼저 매핑합니다.
- 카드별로 구현된 항목, 자동/정적 검사 가능한 항목, 실제 브라우저에서 수동 확인이 필요한 항목을 구분합니다.
- 과제 작업이 끝날 때 결과물 URL, 최신 full commit URL, 재현·통과 확인 4가지, AI와 내 판단 3줄을 함께 정리합니다.
- 이전에 카드 일부만 받은 상태에서 구현했다면 전체 카드가 추가 제공되는 즉시 기존 결과물을 다시 감사합니다.

## T04 실제 날짜 규칙

- T04의 합성 D1/D2 fixture는 실제 날짜 증거로 계산하지 않습니다.
- 실제 공개 원천 기록은 `t04/data/live-history.json`에 서로 다른 Asia/Seoul 날짜별로 최대 2건만 보존합니다.
- 같은 KST 날짜에는 두 번째 실제 기록을 새로 만들지 않습니다.
- 둘째 실제 기록은 다음 KST 날짜에 실제 API를 다시 조회한 뒤에만 추가합니다.
- 실제 기록의 값·단위·source URL·source observed time·조회 시각을 임의로 수정하거나 추정하지 않습니다.

## T06 공개 DB 규칙

- T06에는 로그인을 붙이지 않습니다. 링크를 아는 사람은 누구나 공개 화면과 허용된 T06 조작을 사용할 수 있습니다.
- 개인 일기·연락처·상세 위치 등 민감한 내용은 넣지 않고 공개 가능한 ALEPH 진행 기록만 사용합니다.
- 브라우저는 Supabase 테이블에 직접 접속하지 않고 공개 Edge Function `t06-pds`만 호출합니다.
- DB secret/service-role 원문은 저장소·브라우저·네트워크 응답에 넣지 않습니다.
- T06 테이블은 RLS를 켜고 anon/authenticated 직접 권한을 회수한 상태를 유지합니다.
- 데이터 계약 정본은 `contracts/pds-schema-v2.json`입니다.
- 계획 수정은 기존 계획 snapshot을 `t06_plan_revisions`에 먼저 보존합니다.
- 완료 이벤트는 미완료→완료 전이 한 번당 한 건만 남기며 중복 완료 요청은 새 이벤트를 만들지 않습니다.

## 구현 원칙

- 과제 본문과 카드의 통과 기준에 필요한 기능을 우선 구현합니다.
- 아직 공개되지 않은 다음 카드 조건을 추측해서 과도하게 구현하지 않습니다.
- 기존 과제 결과물을 깨뜨리지 않도록 과제별 파일을 분리합니다.
- 개인정보, 비밀번호, API Key, 토큰, 쿠키, 비밀 환경변수 등 공개 금지 정보를 저장소에 넣지 않습니다.
- 외부 저작물은 공개 권한이 명확하지 않으면 포함하지 않습니다.

## 현재 구조

```text
/
├─ index.html        # T01 + 과제 허브
├─ styles.css
├─ script.js
├─ t02/
│  ├─ index.html     # T02 Gate Sprint 30
│  ├─ styles.css
│  └─ script.js
├─ t03/
│  ├─ index.html     # T03 짤·카드 스튜디오
│  ├─ styles.css
│  └─ script.js
├─ t04/
│  ├─ index.html     # T04 오늘의 진짜 정보판
│  ├─ styles.css
│  ├─ script.js
│  ├─ assets/
│  └─ data/live-history.json
├─ api/t04-live.js
├─ t06/
│  ├─ index.html
│  ├─ styles.css
│  ├─ script.js
│  └─ schema.sql
├─ contracts/pds-schema-v2.json
├─ supabase/functions/t06-pds/
│  ├─ index.ts
│  └─ deno.json
├─ docs/
└─ AGENTS.md
```

이 규칙은 이후 ALEPH 과제 작업에서도 계속 유지합니다.

## T07 인증 및 소유자 보안 원칙

- UI 색상은 T01~T04 과제 결과물과 동일한 어두운 남색/청록 톤을 유지할 것(메인 홈의 베이지/주황 스타일 금지).
- 인증 서비스 이름/버전은 Supabase Auth / `@supabase/supabase-js@2.95.0`.
- 브라우저에 SUPABASE_SERVICE_ROLE_KEY, sb_secret_ 또는 DB service secret을 절대로 두지 말 것.
- T07 인증된 사용자는 본인 owner_id 자료만 열람·편집·삭제할 수 있다. 클라이언트 본문/헤더의 owner_id는 신뢰하지 않는다.
- T07 private tables의 RLS enabled + anon/authenticated 직접 권한 회수를 유지할 것.
- 로그아웃·비밀번호 변경 시 T07 서버 세션을 즉시 폐기한다.
- T06 공개 API를 다시 열지 말 것. `t07_legacy_bundle` 이전 코드를 소스/문서/스크린샷에 노출하지 않는다.
- 5일 기록을 미래 날짜로 미리 생성하지 말 것. 실제 달력이 넘어가고 사용자가 기록해야 하며, 2일차 뒤·3일차 전 정확히 1회 변경.
- 인증 테스트에서 진짜 비밀번호/토큰/이메일 주소를 Git/GitHub 또는 제출문에 남기지 말 것. 실제 성공/실패를 확인하기 전 PASS로 적지 말 것.
