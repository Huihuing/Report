# T07 — 플랜두씨 다이어리 2 최종 제출 정리

> 작성 기준: 2026-10-08, Asia/Seoul. 기존 문서의 초기 미검증 목록은 이 문서의 최신 실측 상태로 대체한다. 완료하지 않은 항목은 완료라고 표시하지 않는다.

## 제출 URL

- **결과물:** https://report-huihuing.vercel.app/t07/
- **소스:** https://github.com/Huihuing/Report/tree/main/t07
- **인증 구현 설명서 6항목:** https://github.com/Huihuing/Report/blob/main/docs/T07-AUTH.md
- **실제 HTTP 요청·응답 증거:** https://github.com/Huihuing/Report/blob/main/docs/T07-HTTP-EVIDENCE.md
- **HTTP 원본 검사 결과 31건:** https://github.com/Huihuing/Report/blob/main/t07/tests/http-security-proof/results-2026-10-08.json
- **소급 개발 기록 5일 회고:** https://report-huihuing.vercel.app/t07/evidence/
- **5일 검산 방법과 원본:** https://github.com/Huihuing/Report/blob/main/docs/T07-RETROSPECTIVE.md
- **고정 T06 소스 커밋:** https://github.com/Huihuing/Report/commit/bb0352766c2b3974b074c3ec2db261679b49f7a7

## 과제 목표·진행 상태

T06에 Supabase Auth 이메일 가입·로그인을 연결했다. 로그인한 계정의 PostgreSQL Plan·Do·See 자료만 조회·수정 가능하게 했고, T06의 기존 공개 API는 410으로 차단했다. 기존 T06의 계획 2개, 할 일 10개, 실행 기록 3개를 실제 계정에 이전했다.

- 실제 브라우저에서 사용자 로그아웃 후 로그인 화면 복귀, 재로그인 뒤 기록 유지 확인.
- 실제 HTTPS POST 시험 **31개 검증 단언 모두 통과**. 단, 이어서 실행할 계정 삭제 시험 이전에 Supabase Auth rate limit 때문에 전체 러너의 `ok` 결과는 false였음.
- 별도 SQL owner 격리·FK·권한 검사 13/13 PASS.
- 로그인 이전·이후 세션 제어, A↔B 양방향 404 읽기·수정·삭제, 소유자 위조 방어, 목록 격리, 비밀번호 변경 뒤 401, bcrypt 해시 차이 확인.
- 계정 삭제 구현/외래키 cascade는 있지만 **계정 삭제 API의 HTTP 성공 응답은 미실측**.
- 내보내기 JSON 구현은 있지만 **브라우저 다운로드 버튼은 미실측**.
- 실제 T07 앱에서 서로 다른 5일 동안 사용 및 당시 2일차 후 규칙 변경은 **미충족**. 공개 Git 커밋 5일 회고(총 230건)는 실제 개발 활동을 소급 검증하는 **별도 보조 증거**이고, 잠긴 앱 5일 실사용 증거를 대신했다고 주장하지 않음.

## 인증 구현 설명서 — ① 무엇으로 붙였나

- 방식: **외부 인증 서비스 — Supabase Auth**, SDK: `@supabase/supabase-js@2.95.0`.
- 비밀번호: Supabase Auth 관리형 bcrypt + 계정별 salt. `auth.users.encrypted_password`에 원문이 아닌 해시 저장.
- 사람 확인: Supabase Auth로 로그인 확인 뒤 T07 서버가 생성하는 256비트 불투명 세션 토큰. 서버 DB에는 토큰 원문이 아니라 SHA-256 해시만 보관.
- 유효기간 60분, 로그아웃 및 비밀번호 변경 시 서버 세션 즉시 폐기.
- Plan·Do·See 데이터: `t07_*` owner_id 기준 DB 테이블, RLS ON + anon/authenticated 직접 테이블 권한 차단.

## ② 왜 골랐나, 대안

직접 비밀번호 저장·salt·암호 검증을 구현하지 않아도 되고, 기존 T06의 Supabase PostgreSQL을 재사용할 수 있으므로 관리형 Supabase Auth를 채택했다. 대안으로 직접 bcrypt 로그인을 만드는 방식은 실수 위험과 보안 책임이 커서 제외했다. Supabase JWT 단독 인증도 고려했지만 로그아웃 직후 이미 발급된 JWT가 만료 전 통할 수 있으므로 서버에서 즉시 삭제 가능한 T07 세션을 추가했다.

## ③ 어디를 어떻게 고쳤나

- `t07/index.html` — 인증 전 로그인/회원가입 화면, 로그인 뒤 전용 다이어리, 계정 관리·5일 기록.
- `t07/script.js` — 로그인/로그아웃, Bearer 세션 전달, Plan·Do·See 상태/CRUD, JSON 내보내기.
- `supabase/functions/t07-pds/index.ts` — `authAction` 가입/로그인, `checkSession` 서버 세션, `getState` 계정별 목록, `verifyOwnPlan`/`verifyOwnTask`/`ownedMutation` 소유자 검증, `logout`/비밀번호 변경/계정 삭제.
- `t07/schema.sql` — owner_id 복합 FK, RLS, 세션, 기록 이력/중복 완료 방지.
- `supabase/functions/t06-pds/index.ts` — 기존 공개 데이터 API를 410 Gone으로 중단.
- `t07/evidence/verify.mjs` — 별도의 소급 Git 활동 기록 5일 SHA·시각·건수 검산.

## ④ 안 열리는 것을 확인한 실제 요청/응답

모든 요청 대상은 같은 HTTPS API `https://sckjbblzivbcoofabhqd.supabase.co/functions/v1/t07-pds`이고 HTTP 방식은 `POST`다.

**로그인 전**
```http
POST /functions/v1/t07-pds
Content-Type: application/json

{"action":"state"}

HTTP/1.1 401 Unauthorized
{"ok":false,"error":"UNAUTHORIZED"}
```

**계정 A 로그인 후 자기 자료 정상 조회**
```http
POST /functions/v1/t07-pds
Authorization: Bearer [가림]
Content-Type: application/json

{"action":"state"}

HTTP/1.1 200 OK
{"ok":true,"plans":[본인 계획만],"tasks":[본인 할 일만],"...":"응답 중 비밀값 및 개인 기록 생략"}
```

**로그아웃 성공 후 같은 Authorization Bearer, 같은 URL·메서드·본문 재사용**
```http
POST /functions/v1/t07-pds
Authorization: Bearer [위 요청과 동일한 값, 가림]
Content-Type: application/json

{"action":"state"}

HTTP/1.1 401 Unauthorized
{"ok":false,"error":"UNAUTHORIZED"}
```

**계정 A → B의 할 일 요청**
```http
POST /functions/v1/t07-pds
Authorization: Bearer [계정 A 세션 가림]
Content-Type: application/json

{"action":"get_task","id":"[계정 B 할 일 ID 가림]"}

HTTP/1.1 404 Not Found
{"ok":false,"error":"NOT_FOUND"}
```

반대 방향 B→A 읽기, 양방향 수정·삭제, 다른 사람 계획 참조도 실제 HTTP 404. 거절 전후 두 시험 계정 각각 자기 할 일 1건과 제목 유지. URL·헤더·JSON 본문에 상대 owner_id를 임의로 넣어도 HTTP 200에 **본인 자료만** 반환. 잘못된 비밀번호와 없는 이메일은 모두 `401 INVALID_CREDENTIALS`. 비밀번호 변경 후 이전 세션도 `401 UNAUTHORIZED`.

비밀번호·세션 토큰·서버 비밀키 **원문은 위 기록에 포함하지 않는다**. 세부 케이스, 실제 응답 상태, 시험 후 계정/데이터 정리 근거는 `docs/T07-HTTP-EVIDENCE.md` 및 `results-2026-10-08.json`을 참조한다.

## ⑤ AI와 나

AI는 Supabase Auth 연동, 소유자별 CRUD, 서버 세션 폐기, API/DB 테스트, 증거 문서와 검산을 구현했다. 나는 T06의 실제 작업 기록을 유지하며 비공개 계정으로 이전하고, 로그아웃·재로그인 후 기록 유지 여부를 직접 확인했다. AI가 생성한 임시 계획과 무근거 작업시간을 실제 기록으로 제출하지 않았으며, 로그인 화면만 잠그고 T06 공개 API를 유지하는 접근도 채택하지 않았다.

## ⑥ 아직 못 막은 것

- Supabase Auth 자체의 유출 비밀번호 차단 기능(Leaked Password Protection) 비활성화 경고, 별도 MFA 미구현.
- 계정·IP 기반 별도 세부 레이트 리미터/모니터링 없음(기본 Auth 제한에 의존).
- 세션 문자열을 sessionStorage에 보관해, 향후 XSS가 생길 경우 탈취 위험이 있음. HttpOnly cookie/CSP 강화 필요.
- 비밀번호 재설정 사용자 흐름 미구현.
- 계정 삭제 버튼의 성공 HTTP 및 다운로드 브라우저 실측 기록 미확보.
- 로그인 앱 5일 실제 사용/동시대 규칙 변경 기록 미확보. 소급 5일 Git 회고로 이를 대체했다고 주장하지 않음.

## 짧은 확인 방법 — 정확히 4줄

1. **어디로 가나요:** https://report-huihuing.vercel.app/t07/ 에 접속하며, 새 시크릿 창에서는 로그인 화면만 보입니다.
2. **세 단계 안에 무엇을 하나요:** 로그인 첫 화면 확인 → 공개 `docs/T07-HTTP-EVIDENCE.md`에서 200/401/404 요청·응답 비교 → 소스의 `checkSession`/소유자 검사를 대조합니다.
3. **무엇이 보이면 통과인가요:** 비로그인 401, 자기 자료 200, 남의 자료 양방향 404, 로그아웃/비밀번호 변경 후 이전 세션 401, T06 기록 보존이 실제 근거와 일치하면 해당 검증이 통과입니다.
4. **안 될 때는 무엇이 보이나요:** 비로그인 조회가 200으로 자료를 노출하거나, 상대방 목록·수정·삭제가 성공하거나, 폐기된 세션이 다시 통하면 실패입니다.

## AI와 내 판단 — 정확히 3줄

1. **AI에게 맡긴 일:** Supabase 인증·T07 서버 세션·DB 소유자 검증·T06 이전·HTTP 31개 실측 시험·증거 정리를 맡겼습니다.
2. **내가 직접 판단한 일:** 실제 과제 4~13 계획을 계정으로 이전하고, 브라우저에서 로그아웃·재로그인과 기록 유지가 되는지 직접 확인했습니다.
3. **AI 제안을 따르지 않은 일:** AI의 임시 가짜 작업시간과 테스트 계획을 내 실제 기록으로 쓰지 않았고, 공개 T06 API를 남긴 채 로그인 화면만 가리는 방식을 선택하지 않았습니다.

## Git 5일 회고(별도 부록)

- 2026-09-28: 67건, 2026-09-29: 3건, 2026-10-06: 3건, 2026-10-07: 61건, 2026-10-08: 96건.
- 선택한 실제 개발 활동 날짜 5일의 공개 Git SHA 총 **230건**, 평균 **46.0건/선택일**.
- 1·2일차 평균 35.0, 3~5일차 평균 53.3건/선택일.
- SHA+저장소 중복 제거, UTC→Asia/Seoul 날짜 변환, 평균 소수 첫째 자리, 결측일 미삽입, 이상치 유지, 주 시작 월요일. 실제 근무시간으로 환산하지 않음.
- 회고 질문/계산 규칙은 오늘 **소급 작성**했다. 과거 T07 앱 로그인/당시 2일차 규칙 변경을 증명하지 않는다.
- 근거: `t07/evidence/source-commits.json`, `t07/evidence/verify.mjs`, `docs/T07-RETROSPECTIVE.md`.

## 현재 배포·회원가입 주의사항 (2026-10-08)

- **운영 결과물 주소는 열리며 기존 로그인 앱도 사용 가능.** 단, Vercel 무료 일일 배포 100건 한도 초과 오류 `402 api-deployments-free-per-day`로 GitHub의 **최신 정적 UI 변경 사항은 아직 운영 도메인에 반영되지 않음**.
- GitHub에 있는 소스와 제출 설명서는 최신으로 보관됐으며, 배포 한도 해제 후 main 최신 커밋을 production에 다시 배포해야 함.
- Supabase T07 가입 API는 Vercel과 별도로 배포해 수정함: 실패했던 가입 요청을 성공이라고 표시하던 문제 해결, 이메일·비밀번호·요청 제한 오류 구분, 인증 링크의 T07 목적지 지정.
- **Supabase 기본 SMTP는 프로젝트 팀에 등록된 이메일 주소 외 인증 메일 전송이 제한됨.** 새 이메일로 가입이 안 될 경우 개인 비밀번호를 제출하지 말고 Supabase 프로젝트 `Authentication → SMTP` 발송 설정 및 `Authentication → URL Configuration`의 `https://report-huihuing.vercel.app/t07/` 허용을 확인해야 함.
- 본계정 삭제 없이 시험 계정에 대한 삭제 동작만 별도 확인할 것.
