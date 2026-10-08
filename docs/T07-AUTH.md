# T07 인증 구현 설명서 / 검증 기록

작성 기준: 2026-10-08 Asia/Seoul
공개 로그인 첫 화면: https://report-huihuing.vercel.app/t07/
소스: https://github.com/Huihuing/Report
T06 고정 기준 커밋: bb0352766c2b3974b074c3ec2db261679b49f7a7

## ① 무엇으로 붙였나

- 분류: 인증 서비스
- 서비스: Supabase Auth (호스팅 관리형 서비스)
- 앱 SDK: `@supabase/supabase-js@2.95.0` (서버 Edge Function import 버전 고정)
- 인증 방법: 이메일 + 비밀번호
- 저장 방법: Supabase Auth `auth.users.encrypted_password` (bcrypt, 자동 salt)
- 로그인 인증 확인 후 T07 자체 32바이트 CSPRNG 불투명 서버 세션 발급
- 세션: T07 전용 `t07_sessions` 테이블에 SHA-256 해시만 저장, 유효기간 60분
- 브라우저: 서버 세션 토큰을 URL이 아닌 sessionStorage + Authorization Bearer 헤더로 전달
- T07 private data: `t07_*` 전용 PostgreSQL 테이블, 모든 자료에 owner_id/auth.users 외래키
- t07 private tables RLS ON, anon/authenticated의 직접 Data API 권한 회수
- 서버는 Supabase service role로 SQL 호출하므로 모든 작업에 본인 owner_id를 명시하고 소유자 확인, 테이블 외래키는 owner_id까지 포함하는 복합 FK를 사용

별도 T07 불투명 서버 세션은 Supabase JWT가 로그아웃 직후에도 만료 시점까지 유효할 수 있는 문제를 보완한다. 공개 인증 서비스 토큰 대신 서버 DB 조회마다 폐기 가능한 세션을 검사한다.

## ② 왜 그걸 골랐나

- 직접 암호 저장·salt·bcrypt 비교 구현을 피하고 검증된 인증 서비스에 맡길 수 있다.
- T06에서 이미 쓰던 Supabase/PostgreSQL과 같은 인프라를 활용한다.
- 로그인 후 자료 접근 소유자/관계 검사와 계정 삭제 연결을 DB에서 유지할 수 있다.
- Supabase Auth JWT 단독 방식도 검토했지만, 로그아웃 후 만료 전 JWT가 남을 수 있으므로 별도 T07 서버 세션을 사용했다.
- 직접 만든 bcrypt 로그인 방식도 검토했지만 인증·비밀번호 안전성을 직접 구현/운영해야 하므로 채택하지 않았다.

## ③ 어디를 어떻게 고쳤나

| 흐름 | 소스 위치 | 동작 |
|---|---|---|
| 가입 | `t07/index.html` #signupForm → `t07/script.js` → `supabase/functions/t07-pds/index.ts` authAction('signup') | 이메일+비밀번호를 HTTPS POST, Supabase Auth에 등록 |
| 로그인 | #loginForm → script.js api('login') → index.ts authAction('login')/createSession | 이메일+비밀번호 확인, 서버 T07 세션 해시 저장, 세션 토큰 60분 만료 |
| 로그아웃 | #logoutButton → api('logout') → index.ts handle('logout') | DB 세션 즉시 삭제, 브라우저 sessionStorage 해제/문서 reload |
| 자료 조회 | script.js loadState() → index.ts checkSession()/getState() | 사용자 식별, `owner_id=uid` 조건으로 각 table 조회 |
| 계획 변경 | index.ts verifyOwnPlan + `t07_update_plan` DB RPC | 주인 확인 후 수정 전 JSON snapshot 저장 |
| 할 일 읽기/변경/삭제 | index.ts verifyOwnTask()/ownedMutation() | 반드시 `owner_id=uid`+id 조건 |
| 완료 중복 방지 | DB `t07_set_completed` RPC | 행 잠금 → 상태 전이에만 completion event 1건 + unique(task_id,cycle_no) |
| T06 기록 이전 | index.ts handle('claim') → `t07_claim_legacy` DB RPC | 48글자 1회용 코드 검증, 트랜잭션 내부에서 6종 T06 자료를 본인 소유로 복사 |
| 비밀번호 변경 | index.ts change_password | 현재 비밀번호 재검증 → Auth 갱신 → 사용자 전체 T07 세션 삭제 |
| 계정 삭제 | index.ts delete_account | 현재 비밀번호 재검증 → 세션 삭제 → Auth 계정 삭제 → FK cascade로 본인 자료 삭제 |
| 5일 사용 | index.ts save_day/change_rule/getState | Asia/Seoul 실제 날짜당 1건, 2일차 뒤·3일차 전 1회 변경, 같은 지표로 합계/평균 계산 |

기존 공개 T06 Edge Function `supabase/functions/t06-pds/index.ts`는 자료 이전 중 우회를 막기 위해 **전 요청 410**으로 교체했다. 제출 당시 T06 소스는 위의 고정 커밋에 보존되어 있다.

## ④ 안 열리는 것을 확인한 기록

**실제 production 배포에서 실행한 무인증 거절 확인 (2026-10-08)**

### 기록 A — 인증 없는 자료 직접 요청

POST `https://sckjbblzivbcoofabhqd.supabase.co/functions/v1/t07-pds`

Request body:
```json
{"action":"state"}
```

Authorization header: 없음

실제 HTTP **401**

Response:
```json
{"ok":false,"error":"UNAUTHORIZED"}
```

### 기록 B — 이전 공개 T06 경로로 우회 시도

POST `https://sckjbblzivbcoofabhqd.supabase.co/functions/v1/t06-pds`

Request body:
```json
{"action":"state"}
```

실제 HTTP **410**

Response error:
```json
{"error":"T06_DATA_MIGRATED_TO_PRIVATE_T07"}
```

두 응답 모두 계획/할 일/실행 기록 본문이 없다. 공개 검증 엔드포인트 `/api/t07-probe`가 상태 코드만 반환한다.

**아직 실제 실행되지 않은 검증 — 제출 전에 반드시 해야 함**

- 계정 A 가입→로그인 200, 로그아웃 후 **동일 URL/방식/기존 Bearer 값**으로 재요청 401
- 비밀번호 변경 후 예전 세션 401
- 계정 A↔B 상호 다른 계정 계획/할 일 GET·UPDATE·DELETE 요청 → 양방향 404
- A/B 자료 목록의 상대방 ID 0개와 거절 전후 상대방 자료 건수 불변
- 잘못된 비밀번호 vs 없는 이메일 동일 메시지 확인
- 실제 서로 다른 계정의 동일 비밀번호 bcrypt hash 값 서로 다름 확인(저장 값 원문 비밀번호는 기록 금지)
- 모든 요청/응답 비밀번호·세션·비밀키 값 `[가림]` 처리

위 검증은 실제 인증된 계정/세션이 없을 때 **PASS로 간주하지 않는다.**

## ⑤ AI와 나

- AI에게 맡김: T07 전용 PostgreSQL 테이블, Supabase Auth API 연결, 소유자 검증, 로그아웃 후 서버 세션 폐기, T06 자료 1회 이전, 로그인 화면 및 5일 기록 집계
- 내 판단: 2026-10-08 T06에 실제 입력했던 ALEPH 4~13 계획을 계정으로 이어갈 것, T05 여러 AI 검증 때문에 오래 걸렸던 실제 See 내용을 유지할 것
- 따르지 않은 제안: AI가 만들었던 검사용 시간/예시 계획을 본인 기록으로 간주하지 않음. 다른 사람에게 공개된 T06 상태를 T07 로그인 뒤에도 그대로 두는 방식을 채택하지 않음

## ⑥ 아직 못 막은 것

- 아직 T07 전용 세부 IP·계정별 로그인 시도 throttling을 별도로 추가하지 않았다. Supabase Auth 기본 rate limit에 의존하며, 계정 공격이 집중될 경우 별도 rate limiter와 모니터링이 필요하다.
- T07은 두 번째 인증수단(MFA), 비밀번호 재설정 사용자 흐름을 제공하지 않는다.
- 브라우저 sessionStorage에 세션 토큰을 저장한다. 저장된 문자열을 textContent로 출력하지만 향후 스크립트 삽입 취약점이 생기면 세션 탈취 위험이 있으므로 CSP 강화와 HttpOnly cookie 방식으로 이행할 필요가 있다.
- 세션은 60분 후 만료하며 현재 자동 갱신을 제공하지 않는다. 데이터 손실을 막으려면 저장 뒤 상태 확인이 필요하다.
- 사용자 계정 가입·로그인 및 두 계정 침범 테스트가 완료되기 전에는 실제 가입 성공/양방향 격리를 검증했다고 주장할 수 없다.
- 2026-10-08 당일에는 서로 다른 날짜 5일 기록을 만들 수 없다. 미래 날짜 선입력은 차단되며 진짜 5일간 누적해야 한다.

## 5일 사용 실험: 오늘 기준 상태

- 첫날 질문: **하루 계획한 과제 작업에 실제 얼마나 많은 시간이 걸렸는가?**
- 지표: Git 기록 또는 직접 측정한 과제 진행 시간
- 단위: 분
- 계산: 겹치지 않는 확인 가능 구간을 합계, 분 단위 반올림
- 결측: null, 합계/평균 계산에서 제외
- 중복: 서울 시간 기준 날짜별 1건(수정은 덮어쓰기)
- 이상치: 제외하지 않고 사유 보존
- 반올림: 평균 소수 첫째 자리
- 주 시작: 월요일
- 초기 규칙: 과제마다 통과 기준을 확인한 다음 작업을 시작한다.
- 1일차 원본: 2026-10-08 T06 Git 근거 106분 (정확한 개인 집중 시간과 다를 수 있음)
- 2~5일차: 실제 날짜에 사용자가 입력해야 함
- 변경 규칙: 2일차 저장 뒤 사용자 판단으로 딱 1회 변경, 3일차 기록 전에 확정

표시되는 합계·평균은 날짜별 `metric_minutes` 값의 합계와 유효 표본 개수로 계산한다.

## 보안 기록 보관 규칙

- 제출 문서에 실제 이메일, 평문 비밀번호, 서버 세션 토큰, service-role 키, Auth JWT를 기록하지 않음
- 예시 토큰 표기는 `[가림]`으로 대체
- Git/GitHub 소스에는 환경변수 이름만 사용, 실제 private key 입력 안 함
- API 로그에 비밀번호·토큰 요청 본문을 직접 console.log 하지 않음
