# T08 인증 구현 설명서 — 패스키로 잠긴 비공개 공간

작성 기준: **2026-10-09 (Asia/Seoul)**. 실제 완료와 미실행 항목을 구분한다.

- 공개 T01 첫 화면: https://report-huihuing.vercel.app/
- T08 공개 입구: https://report-huihuing.vercel.app/t08/
- API: `https://sckjbblzivbcoofabhqd.supabase.co/functions/v1/t08-passkey`
- 소스: `index.html`, `t08/index.html`, `t08/script.js`, `t08/styles.css`, `t08/schema.sql`, `supabase/functions/t08-passkey/index.ts`
- 실측 증거: `t08/evidence/http-2026-10-09.json`

## ① 무엇으로 붙였나

- **WebAuthn / FIDO2 패스키**, 네이티브 브라우저 `navigator.credentials.create()`/`get()`, 서버 서명 검증 **SimpleWebAuthn `@simplewebauthn/server@13.2.2`** 버전을 사용.
- 비밀번호를 만들거나 입력하는 필드는 없으며, 이메일/계정 비밀번호 가입 없이 **패스키 첫 등록이 새 개인 공간 생성**으로 이어진다.
- **등록:** 서버가 RP ID `report-huihuing.vercel.app`, origin `https://report-huihuing.vercel.app` 고정, 5분 만료 등록 challenge를 Postgres에 보관하고, 기기가 만든 WebAuthn attestation에 포함된 응답을 검증한다. `userVerification: required`, `residentKey: required`.
- **저장:** `public.t08_credentials.public_key_b64`는 COSE 형식 공개키 바이트의 Base64URL 인코딩값. ID, 카운터, 이름, 기기/백업 정보, 등록 시각과 함께 서버 DB에 보관. 개인키와 기기 PIN/생체정보는 전송·저장하지 않는다.
- **로그인:** 서버가 매번 새로운 login challenge 생성, 등록 공개키로 `verifyAuthenticationResponse()` 서명을 검증한 뒤 256비트 난수 **서버 세션** 발급. `public.t08_sessions`에는 SHA-256 해시만 저장, 60분 만료.
- DB 테이블 `t08_accounts`, `t08_credentials`, `t08_challenges`, `t08_sessions`, `t08_private_notes` **모두 RLS 활성화**, `anon`/`authenticated` 직접 SELECT/조작 권한 없음. Edge Function의 서비스 역할만 필요한 데이터 접근.
- 실제 패스키가 아직 등록되지 않았기 때문에 **실제 공개키 원문과 선택한 저장 위치(예: Windows Hello/Google 비밀번호 관리자)는 아직 적을 수 없다.** 이는 기기 등록 후 추가할 항목이다. 임의 공개키를 가짜로 제출하지 않는다.

## ② 왜 그걸 골랐나

WebAuthn은 서버가 임의의 일회용 challenge를 보내고 기기가 개인키로 서명하며, 서버는 보관한 공개키로만 검증한다. 사이트 비밀번호를 서버에 보관할 필요가 없다. 직접 CBOR 파서·COSE 서명/attestation을 처음부터 만드는 것보다 SimpleWebAuthn을 쓰면 RP ID, Origin, 서명과 사용자 인증 검증 실수를 줄일 수 있어 채택했다. 대안으로 Supabase Auth의 비밀번호 로그인이나 직접 구현한 공개키 서명 프로토콜을 검토할 수 있으나 과제의 **비밀번호 없는 표준 패스키** 조건에 맞게 WebAuthn을 선택했다.

## ③ 어디를 어떻게 고쳤나

| 흐름 | 브라우저 | 서버/DB |
|---|---|---|
| 공개 소개 | 루트 `index.html`, 기존 T01 보존 및 T08 카드 추가 | 로그인 요구 없음 |
| 첫 패스키 등록 | `t08/script.js` `register(false)`: register_begin → `navigator.credentials.create` → register_finish | `supabase/functions/t08-passkey/index.ts` `register_begin/register_finish`, `verifyRegistrationResponse`; `t08_initialize_account` SQL RPC |
| 두 번째 패스키 | `register(true)`, 기존 서버 Bearer 세션 필수 | 본인 owner_id에만 추가; 기존 credential ID는 excludeCredentials |
| 패스키 로그인 | `login()`: login_begin → `navigator.credentials.get` → login_finish | `verifyAuthenticationResponse`; 소유자 식별, 검증 성공 후 서버 세션 생성 |
| 로그아웃 | `logoutBtn` → logout, sessionStorage 제거 | `t08_sessions`의 세션 해시 즉시 삭제 |
| 비공개 자료 조회 | `refresh()`: `POST action=private`, 서버 응답 뒤만 DOM 생성 | `currentUser` 없으면 401, `privateState`의 `owner_id` 필터 필수 |
| 패스키 관리 | 이름·등록 시각 표시, 추가/삭제 버튼 | `remove_passkey`, SQL `t08_remove_credential` 마지막 키 삭제 방지 |
| 도전 과제 1회 사용 | 서버에서 발급된 request_id만 다시 전송 | `t08_take_challenge` SQL RPC 단일 UPDATE에서 소비 / 재사용 불가 |

## ④ 안 열리는 것을 확인한 기록

**2026-10-09 실제 공개 Supabase Edge Function HTTPS 요청 결과**. 값은 가리거나 미포함했다.

### A. 비로그인 → 서버 거절

```http
POST /functions/v1/t08-passkey
Content-Type: application/json

{"action":"private"}

HTTP/1.1 401 Unauthorized
{"ok":false,"error":"UNAUTHORIZED"}
```

HTTP 200으로 열린 공개 `/t08/`의 HTML 응답에도 개인 메모 본문 원문은 포함되지 않았다. 공개 HTML 안에 단순히 숨겨 두지 않았으며, 예시 메모 내용은 첫 실제 기기 등록을 완료할 때 DB에 새로 생성된다.

### B. 매번 새로운 challenge

각각 다른 `register_begin` 2회 → **200**, 양쪽 응답에 `options.challenge` 존재, 값은 **서로 다름**. `login_begin` 2회도 **200**이며 `options.challenge` 서로 다름. challenge 원문과 개인 세션은 증거 JSON에 저장하지 않음.

### C. 등록 응답 실패 및 재사용

```http
POST /functions/v1/t08-passkey
{"action":"register_finish","request_id":"[가림]","credential":{"id":"invalid","type":"public-key"}}

HTTP/1.1 400 Bad Request
{"ok":false,"error":"INVALID_ATTESTATION"}
```

**동일 request_id·동일 URL·동일 메서드·동일 본문 재전송:**

```http
HTTP/1.1 409 Conflict
{"ok":false,"error":"CHALLENGE_EXPIRED_OR_USED"}
```

### D. 로그인 실패 및 이미 쓴 질문 재사용

```http
POST /functions/v1/t08-passkey
{"action":"login_finish","request_id":"[가림]","credential":{"id":"invalid","type":"public-key"}}

HTTP/1.1 400 Bad Request
{"ok":false,"error":"INVALID_ASSERTION"}
```

동일 request_id로 **재호출 → HTTP 409 CHALLENGE_EXPIRED_OR_USED**.

### E. DB 접근통제

실제 SQL 카탈로그/테이블 검사: 다섯 T08 테이블 모두 RLS ON, 익명/일반 사용자 역할 직접 SELECT 없음. 현재 첫 패스키 실제 등록 전이라 계정 수 **0**, 저장된 패스키 수 **0**, 가상 비공개 메모 수 **0**. 이 수치를 사용자가 등록한 것처럼 꾸미지 않는다.

### F. 아직 검증되지 않은 실기기 항목

다음은 장치에서 WebAuthn을 실제로 실행해야 확인 가능하며, 현재 **PASS 증거가 없는 상태**다.

1. 실제 패스키 A 등록 성공, 공개키 실 저장값 및 저장 위치/등록 취소.
2. 실제 패스키 A 로그인 성공 200 / 잘못된 서명 거절 / 로그아웃 후 동일 Bearer 401.
3. 동일 계정에 패스키 2개 등록 → 하나 삭제 → 남은 키로 로그인 성공 / 제거한 키 로그인 실패.
4. 독립 계정 A와 B를 각각 실제 패스키로 등록 → B의 비공개 노트에 A 세션으로 접근 거절, B→A 역방향 거절, 앞뒤 노트 수 동일.
5. URL/본문 `owner_id` 위조 뒤에도 본인 자료만 내려오는 실제 성공 세션 응답.
6. 공개키 전체 값/등록 날짜/실제 패스키 저장 제공자 스크린샷.

**증거 원본:** https://github.com/Huihuing/Report/blob/main/t08/evidence/http-2026-10-09.json

## ⑤ AI와 나

- **AI에게 맡긴 일:** WebAuthn 서버 질문 생성·검증, 공개키 저장, 서버 세션/서명 확인, 공개/비공개 분리, 복수 패스키 관리 UI, 가상 자료 생성, 자동 HTTP 차단 검증과 문서화를 맡겼다.
- **내가 직접 판단한 일:** T01 공개 소개를 그대로 유지하고 T08 비공개 메모만 패스키로 잠그며, 실제 개인 연락처·신분증 등은 포함하지 않는 것으로 결정했다.
- **AI 제안을 따르지 않은 일:** 실제 기기에서 확인되지 않은 등록/로그인/두 키 복구를 자동 PASS로 표기하지 않고, 남은 수동 실측으로 분리했다.

## ⑥ 아직 못 막은 것

- 패스키가 모두 분실된 계정은 로그인용 비밀번호나 복구 이메일이 없어 **계정 복구 불가능**. 그래서 마지막 패스키 삭제를 거절하나, 사용자가 모든 기기를 분실하면 복구가 어렵다.
- Bearer 토큰을 sessionStorage에 보관하므로 같은 origin에서 XSS가 발생할 경우 세션 탈취 우려. CSP, HttpOnly 쿠키와 동일 사이트 프록시 검토 필요.
- 등록용 challenge를 무제한 만들려는 요청에 자체 IP별 제한이나 CAPTCHA가 없다. 5분 만료 및 1회 사용만 구현.
- 패스키 삭제는 현재 유효한 세션만 요구하여 **삭제 시 즉시 패스키 재인증(reauth)** 단계를 추가하는 개선이 바람직하다.
- 동기화된 패스키는 기기간 같은 자격 증명일 수 있으므로 **동일한 패스키를 단순히 다른 기기에서 사용한다고 독립 복구 수단 두 개로 간주하면 안 된다.** 두 번째 등록에서는 서로 다른 credential ID를 확인해야 한다.

## 평가 항목 체크

- T08-C10~18: 공개 T01 유지, 화면 경계, 서버 unauth 401, HTML 비공개 자료 없음. **일부 구현·HTTP 실측 완료**. 자료 3건은 **첫 실제 등록 뒤** 생성됨.
- T08-C19~20, C27~28: 등록/로그인 새 challenge HTTP 실측. **완료**.
- T08-C31: **실제 서버 로그인 질문을 재사용한 요청**의 HTTP 409 재사용 거절 기록. **완료**. 단 정상 성공 로그인 자체는 아직 실기기 미검증.
- T08-C21~26, C29~30, C32~46: 실제 두 계정, 실제 기기 자격 증명으로 확인해야 하는 항목. **미완료**.
- T08-C47~53: 설명서 6항목, 제출문 4줄/3줄 작성. **구현 완료**. 제출 전 실제 기기 증거 추가가 필요.

## 실기기 최종 확인 순서

1. HTTPS 공개 주소 `/t08/`에서 **새 공간 만들기**를 클릭하고 기기의 패스키 등록을 완료한다. 저장 위치를 기록하고 개인정보 없이 스크린샷을 남긴다.
2. 첫 계정에서 **두 번째 패스키 등록**을 클릭하여 다른 credential ID가 나타나는지 확인한다. 하나를 삭제한 뒤 로그아웃하고 남은 키로 다시 로그인한다. 삭제된 키로도 시도하여 거절을 확인한다.
3. 다른 브라우저 프로필에서 **새 공간 만들기**를 눌러 계정 B를 준비한다. A/B 각각의 세션으로 서로의 자료 ID를 직접 요청해 403/404, 사전·사후 메모 건수를 확인한다.
4. 로그인 성공, 세션 폐기 후 동일 토큰 재사용의 401 결과, 서버 공개키 값과 패스키 저장 제공자를 증거 문서에 덧붙인다. 비밀키·토큰·실제 개인정보는 기록하지 않는다.
