# T07 실제 HTTP 인증·접근통제 검사 증거

검사 날짜: **2026-10-08 (Asia/Seoul)**  
공개 앱: https://report-huihuing.vercel.app/t07/  
실제 API: `POST https://sckjbblzivbcoofabhqd.supabase.co/functions/v1/t07-pds`  
근거 원본: `t07/tests/http-security-proof/results-2026-10-08.json`  
검사 소스: `t07/tests/http-security-proof/index.ts`  
기존 SQL 모의 검사: `t07/tests/ab-rollback.sql`

## 검사 환경 및 비밀값 보호

- 실제 Supabase Auth의 관리자 테스트 계정 **A/B 두 개**를 생성했다. 동일한 무작위 강력 비밀번호를 두 계정에 사용해 bcrypt salt 비교를 가능하게 했다.
- 서버에 로그인하고 발급된 T07 **실제 60분짜리 불투명 세션 Bearer**로 공개 API에 HTTPS POST 요청했다. 생성된 비밀번호·토큰·이메일·UUID 원문은 Git/제출물에 기록하지 않았다.
- 테스트는 정상 접근 `200`과 상대방 데이터 접근 `404`, 비인증 `401`을 **실제 HTTP 응답**으로 각각 확인했다. DB에서 owner_id 조건을 흉내 내기만 한 검사가 아니다.
- 시험용 관리자 Edge Function은 **1회용 무작위 challenge 해시 검증**을 통과한 뒤에만 작동했다. 검사 직후 본 함수의 실제 배포 버전은 `410 SECURITY_PROOF_DISABLED`로 교체했다.
- 생성한 두 Auth 계정은 테스트 종료 시 관리자 API로 모두 삭제했고, 연결된 테스트 계획·할 일도 FK cascade로 삭제했다.
- 시험 직후 DB 검산: **실제 계획 2건 / 할 일 10건 / 실행 3건 / 1일차 1건**, 시험 계획 **0건**, 현재 등록 Auth 계정 3개로 복귀.
- 최초 큰 테스트에서 실행된 HTTP·DB 검증 **31개 단언 31개 PASS**. 이후 Supabase Auth가 `Rate limit exceeded`를 반환해 마지막 '계정 삭제 API' 시도에 들어가지 못했으므로, 최초 실행 전체 결과를 `ok:true`로 **조작하지 않았다**.

## ① 로그인 성공과 잘못된 계정 오류

```http
POST /functions/v1/t07-pds
Content-Type: application/json

{"action":"login","email":"[시험 계정 A 이메일 가림]","password":"[가림]"}
```

실제 응답: HTTP **200**, 본문 `ok:true`, `token:[가림]`, `expires_at:[만료시각]`.

다른 존재하는 계정의 틀린 비밀번호와 아예 없는 이메일에 대해 모두 다음과 같이 **401 및 동일 오류**를 확인했다.

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{"ok":false,"error":"INVALID_CREDENTIALS"}
```

## ② 로그인 성공 뒤 같은 엔드포인트 로그아웃 거절

성공 요청:

```http
POST /functions/v1/t07-pds
Authorization: Bearer [가림]
Content-Type: application/json

{"action":"state"}
```

실제 응답: HTTP **200**, 본인 계획·할 일 반환(상대방 자료 없음).

동일한 `POST /functions/v1/t07-pds`, 동일한 JSON `{"action":"state"}`, 동일한 Bearer 토큰으로 **`{"action":"logout"}` 성공 직후** 다시 요청:

```http
HTTP/1.1 401 Unauthorized

{"ok":false,"error":"UNAUTHORIZED"}
```

이 검증은 브라우저의 화면 전환이 아니라 **서버에서 이전 세션 자체가 무효해진 것**을 확인한다.

추가로 B 계정의 비밀번호 변경 API가 HTTP **200**을 반환한 뒤, B의 이전 Bearer로 같은 `state` 요청 → **401 UNAUTHORIZED** 확인. 새 비밀번호 재로그인은 HTTP **200**.

## ③ 계정 A ↔ B 반대 방향 접근 거부

```http
POST /functions/v1/t07-pds
Authorization: Bearer [계정 A 세션 가림]

{"action":"get_task","id":"[계정 B의 할 일 UUID 가림]"}
```

실제 응답:

```http
HTTP/1.1 404 Not Found

{"ok":false,"error":"NOT_FOUND"}
```

반대 방향 B 세션으로 A 할 일 조회 역시 HTTP **404 NOT_FOUND**.

| 동작 | 계정 A가 B 대상 | 계정 B가 A 대상 |
|---|---|---|
| 상대방 계획 `get_plan` | **404 NOT_FOUND** | **404 NOT_FOUND** |
| 상대방 할 일 `get_task` | **404 NOT_FOUND** | **404 NOT_FOUND** |
| 상대방 할 일 `update_task` | **404 NOT_FOUND** | **404 NOT_FOUND** |
| 상대방 할 일 `delete_task` | **404 NOT_FOUND** | **404 NOT_FOUND** |

수정 요청은 `{"action":"update_task","id":"[상대 UUID]","title":"forbidden","due_date":"2026-10-08","priority":"low","expected_minutes":0}`로 보냈다.

삭제 요청은 `{"action":"delete_task","id":"[상대 UUID]"}`로 보냈다.

응답 후 계정 A/B의 각각 자기 `state`를 다시 호출하여 임시 할 일 제목이 그대로 `private A` / `private B`, 각각 **할 일 1건**인 것 확인. 거절 뒤의 상대방 데이터 건수·제목·목록 불변.

또한 B가 A의 계획 ID에 `create_task` 요청한 결과 HTTP **404 NOT_FOUND**.

## ④ 소유자 위조·목록·무인증 직접 요청

B의 유효 세션이지만 URL `?owner_id=[A UUID]`, 헤더 `x-owner-id:[A UUID]`, 요청 본문 `{"action":"state","owner_id":"[A UUID]","plan_id":"[A 계획 UUID]"}`를 보낸 결과:

- 실제 HTTP **200** 응답에는 B 자신의 계획·할 일만 포함됐고 **A의 계획 UUID는 포함되지 않음**.
- A/B가 각각 `state`로 목록을 호출하면 자기 할 일만 1건, 상대 계획·할 일은 0건.
- 유효 세션 없는 `POST {"action":"state"}`는 실제 HTTP **401 UNAUTHORIZED**, 사용자 데이터 본문 없음.

## ⑤ 비밀번호 저장 및 폐기 가능성

- 같은 강력한 무작위 비밀번호로 서로 다른 Supabase Auth 시험 계정 두 개를 생성.
- 저장된 `auth.users.encrypted_password`를 서버 전용 SQL 함수로 비교.
- 실제 반환된 검사 결과: 두 계정 모두 존재, 해시 값 서로 다름, 저장 값 bcrypt 형식, 평문이 아닌 해시 길이 → **모두 true**.
- 시험 종료 후 해당 계정은 삭제했다. 해시 자체와 평문 비밀번호는 공개 제출물에 기록하지 않았다.
- 서버 코드/응답에는 service role 비밀키나 요청 비밀번호를 콘솔로 출력하는 코드가 없음(패턴 검사와 소스 확인 별도). 완전한 로그 전체 검사는 별도로 수행해야 한다.

## ⑥ 한계와 누락

**첫 실행 중단 사유:** 31번째 PASS 이후 Supabase Auth rate limit이 발생해 계정 삭제용 HTTP 요청을 수행하지 못함. 계정 삭제는 테스트 runner의 관리자 cleanup으로 수행되어 **시험용 Auth 계정 2개 및 임시 자료 모두 정리 성공**. 따라서 첫 실행으로 계정 삭제 앱 흐름까지 PASS라고 표시하면 안 된다.

기능별 검증을 추가 수행하면 본 문서를 업데이트하며, 누락 상태는 그대로 명시한다.

## 거절을 만드는 소스 위치

`supabase/functions/t07-pds/index.ts`

- `checkSession`: T07 세션 SHA-256 일치/만료 확인, 없거나 로그아웃된 값은 401
- `getState`: `owner_id=uid`로 자료 목록 조건 부여
- `verifyOwnPlan`, `verifyOwnTask`: 외부에서 전달된 ID가 본인 소유가 아니면 `NOT_FOUND`
- `ownedMutation`, `update_task`, `delete_task`: 변경/삭제에서 `owner_id=uid` 검사
- `logout`: T07 세션 해시 DB 삭제
- `change_password`: 기존 사용자 세션 일괄 삭제

`t07/schema.sql`: owner_id 포함 composite FK, t07_sessions, t07_set_completed SQL RPC, RLS ON 및 anon/authenticated 직접 권한 거부.

## AI와 사람의 확인 범위

AI가 공개 API에 독립 시험 계정으로 POST를 보내 응답 상태를 자동 기록했고, 사용자는 별도로 실제 로그인/로그아웃/재로그인 후 기록 보존을 브라우저에서 확인했다. **로그인 상태 HTTP 호출 결과와 사용자 화면 확인은 서로 다른 검증**이다.
