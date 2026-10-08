# T07 회원가입·이메일 인증 장애 확인 방법

## 확인된 문제 (2026-10-08)

- T07 가입 API에서 Supabase Auth `signUp`이 오류를 반환해도 이전 소스가 `ok:true`를 보내는 버그가 있었음.
- 해당 코드는 서버에서 수정했고, `supabase/functions/t07-pds/index.ts` GitHub 정본에도 반영했음.
- Supabase Auth 기본 SMTP는 **프로젝트 팀원 이메일만 발송 가능**하며 사용자 임의의 신규 이메일은 인증메일 전송이 거절될 수 있음. 이는 T07 클라이언트 비밀번호 문제와 별개.
- 가입 요청이 짧은 기간에 다수 발생하면 Auth 메일 발송/인증 시도 rate limit도 적용될 수 있음.
- 기존 Supabase Auth 이메일 기본 Site URL은 `localhost:3000`인 경우가 있어 가입 인증 링크가 로컬로 이동할 수 있음.

## 서버/API 수정 내용

1. 가입 오류 무시 제거: `signUp` 오류를 422/429/503 중 실제 사유에 가까운 코드로 변환.
2. `email_address_invalid` → `INVALID_EMAIL` (422), `over_email_send_rate_limit` 또는 `over_request_rate_limit` → `TRY_AGAIN_LATER` (429), `weak_password` → `PASSWORD_TOO_WEAK` (422).
3. 그 밖의 가입 서비스 오류는 `SIGNUP_SERVICE_ERROR` (503)로 표시하고 코드값만 서버 로그에 기록함. 비밀번호나 이메일 원문은 로그에 남기지 않음.
4. 비밀번호 오류/존재하지 않는 계정 → 동일 `INVALID_CREDENTIALS` (401). 이메일 인증 전 로그인의 경우 `EMAIL_NOT_CONFIRMED` (403).
5. 가입 `emailRedirectTo`를 `https://report-huihuing.vercel.app/t07/`로 지정.
6. 프런트 가입 안내 개선은 `t07/script.js` 및 `t07/index.html`에 저장. **Vercel 일일 배포 한도 때문에 운영 정적 UI에는 미배포**. Supabase Edge Function은 독립 배포되어 최신 서버 수정 적용.

## Supabase 관리자 설정 확인 순서

1. [Authentication → SMTP](https://supabase.com/dashboard/project/sckjbblzivbcoofabhqd/auth/smtp)에서 메일 발송 설정 확인. 본인 팀 이메일 이외 새 주소로 가입 시험하려면 **외부 SMTP 설정이 필요할 수 있음**.
2. [Authentication → URL Configuration](https://supabase.com/dashboard/project/sckjbblzivbcoofabhqd/auth/url-configuration)에서 Site URL 및 허용 Redirect URL에 `https://report-huihuing.vercel.app/t07/`을 등록. 인증 메일 링크가 localhost로 가지 않도록 확인.
3. 새 테스트 계정을 만들 목적이라면 [Authentication → Users](https://supabase.com/dashboard/project/sckjbblzivbcoofabhqd/auth/users)에서 관리자 계정 생성/확인 기능을 사용할 수 있는지 확인. **기존 T06 자료가 연결된 실제 계정은 삭제하지 말 것.**
4. 시험용 계정은 본인 계정과 별개로 만들고, 로그인이 확인되면 오직 시험용 계정에서 삭제 기능을 확인. 비밀번호·세션 토큰을 GitHub/채팅/제출문에 공개하지 말 것.

## 관련 공식 문서

- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/auth/passwords

## 검증/한계

- 실제 이전에 Supabase Auth 로그에 이메일 오류 `email_address_invalid`, 잘못된 로그인 `invalid_credentials`, 반복 가입 `user_repeated_signup` 유형이 나타남. 어떤 오류가 **특정 사용자 이메일에 대응되는지**는 공개 기록만으로 단정하지 않음.
- 서버 Edge Function을 새 버전으로 배포했으나 새 테스트 이메일의 회원가입 성공은 SMTP 설정과 이메일 소유 확인이 끝나기 전까지 입증되지 않음.
- 사용자 가입이 거절되면 무조건 '가입 접수 완료'로 답하던 버그는 코드상 수정됨. 운영 정적 UI의 새로운 한국어 설명은 Vercel 재배포 전까지 표시되지 않을 수 있음.
