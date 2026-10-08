# T06 전체 카드 검사 기록

검사 기준일: 2026-10-08 (Asia/Seoul)  
결과물: https://report-huihuing.vercel.app/t06/

## 저장 구조

- 서버 DB: PostgreSQL (Supabase)
- 공개 브라우저 → 공개 Edge Function `t06-pds` → T06 전용 DB 테이블
- 브라우저에서 Supabase Data API 테이블 직접 접근: 사용하지 않음
- `anon` / `authenticated`의 T06 테이블 직접 권한: 회수
- T06 테이블: RLS enabled
- Edge Function의 DB secret은 Supabase 서버 환경변수에서만 읽음
- 데이터 계약: `contracts/pds-schema-v2.json`
- 재현 SQL: `t06/schema.sql`

실제 권한 검사:

- anon → t06_plans SELECT: false
- anon → t06_tasks INSERT: false
- authenticated → t06_execution_logs SELECT: false
- anon → t06_set_task_completed RPC EXECUTE: false
- service_role → t06_set_task_completed RPC EXECUTE: true

## 실제 계획 — 2026-10-08

메인 계획은 사용자가 실제로 밝힌 오늘 계획을 그대로 옮겼다.

- 계획명: `오늘 ALEPH 과제 4부터 13까지 완료 도전`
- 기간: 2026-10-08
- 우선순위: high
- 성공 기준: 아침 일찍 과제 4 완료를 시작으로 과제 13까지 순서대로 진행하고, 실제 진행 상황과 막힌 이유를 기록해 검증 반복을 줄인다.
- 예상 시간: 900분
- 예상 시간 입력 방식: 오늘 하루 계획을 앱에 옮기기 위한 작업 예산으로 과제당 90분 × 10개를 사용했다. 과거에 사용자가 정확히 90분씩 예상했다고 주장하지 않는다.

실제 할 일은 **과제 4~13 총 10개**다.

현재 상태:

- 과제 4: 완료
- 과제 5: 완료
- 과제 6: 진행 중
- 과제 7~13: 예정

## 카드 1 — 계획 수정 이력

메인 plan ID를 유지한 채 계획 성공 기준 문구를 한 번 구체화했고, 수정 직전 snapshot을 `t06_plan_revisions`에 먼저 저장했다.

수정 전 성공 기준:

> 아침 일찍 과제 4 완료를 시작으로 오늘 가능한 한 과제 13까지 순서대로 진행한다. 최종 목표는 오늘 과제 13까지 도달하도록 최대한 노력하는 것이다.

현재 성공 기준:

> 아침 일찍 과제 4 완료를 시작으로 과제 13까지 순서대로 진행한다. 현재 진행 상황을 실제 Git 커밋과 화면 확인으로 기록하고, 막힌 이유를 돌아보기에 남겨 다음 과제의 검증 반복을 줄인다.

수정 이력 1건이 별도 row로 보존된다.

## 카드 2 — 할 일

메인 계획에 지우지 않은 실제 할 일 **10개**가 저장되어 있다.

각 할 일은 다음 값을 가진다.

- due_date = 2026-10-08
- priority
- tags[]
- expected_minutes = 90
- completed / completed_at
- soft delete용 deleted_at

공개 화면은 만들기·고치기·완료·되돌리기·지우기·검색·필터를 지원한다.

정렬 기준은 화면에 다음과 같이 고정해 표시한다.

> 마감일 오름차순 → 우선순위 높음/보통/낮음 → 생성 시각 오름차순

## 카드 3 — 실제로 한 일

Do 기록은 임의 작업시간이 아니라 오늘 Git commit 시간대로 확인되는 구간을 근거로 저장했다.

### Do 1 · 과제 4 최종 완료

- 시작 근거: `349195c9…` — 2026-10-08 08:16:51 KST
- 종료 근거: `59cc7632…` — 2026-10-08 08:17:38 KST
- DB actual_minutes: 1분
- 비고: 이 값은 과제 4 전체 작업시간이 아니라 Git에서 확인 가능한 **최종 완료/기록 확정 구간**이다.

### Do 2 · 과제 5

- 시작 근거: `400b36f4…` — 2026-10-08 09:17:21 KST
- 종료 근거: `99c2fd75…` — 2026-10-08 10:47:53 KST
- DB actual_minutes: 91분
- 막힘 이유: 여러 AI 세션·모델 검증과 재검증, T04 정본 17파일 확인, 다른 모델 조건(C39) 보완 때문에 예상보다 검증 반복이 길어졌다.

### Do 3 · 과제 6 진행 중

- 시작 근거: `c4664199…` — 2026-10-08 12:24:23 KST
- 현재 기록 구간 종료 근거: `7ad6b4cd…` — 2026-10-08 12:38:46 KST
- DB actual_minutes: 14분
- 막힘 이유: 초기 검증용 데이터가 사용자의 실제 오늘 계획이 아니어서 실제 계획과 Git 근거 Do 기록으로 교체하기로 했다.
- 이 기록은 과제 6 전체 종료 시간이 아니라 **현재까지 확인 가능한 진행 구간**이다.

현재 Do 기록 합계: **106분**

## 완료 중복 방지 실제 DB 검사

검사용 임시 task를 만든 뒤 같은 task에 완료=true를 연속 두 번 적용했다.

결과:

- completed = true
- completion_events = 1
- completion_cycle = 1

검사용 task는 검사 후 삭제했다.

따라서 버튼 disabled에만 의존하지 않고 DB 상태 전이 함수 + `unique(task_id, cycle_no)` 제약으로 중복 완료 기록을 막는다.

## 카드 4 — See와 다음 계획

현재 메인 계획 집계는 공개 Edge Function 실제 POST 기준으로 다음과 같다.

| 항목 | 값 |
|---|---:|
| 계획 수(지우지 않은 할 일 수) | 10 |
| 완료 수 | 2 |
| 지연 수 | 0 |
| 막힘 수 | 2 |
| 예상 시간 | 900분 |
| 실제 시간 | 106분 |
| 차이(실제-예상) | -794분 |
| 실행 기록 | 3건 |
| 수정 이력 | 1건 |
| 돌아보기 | 1건 |

지연은 `completed=false AND due_date < Asia/Seoul today`만 세므로 오늘 마감인 미완료 항목은 아직 지연이 아니다.

실제 See:

> 과제 5는 여러 AI 검증과 재검증 때문에 예상보다 오래 걸렸다. 현재 과제 6을 진행 중이며, 다음 과제부터는 통과 기준과 직접 확인할 항목을 먼저 고정해 검증 반복을 줄인다.

이 한 줄은 다음 계획 `남은 ALEPH 과제 7~13 진행`의 `next_from_reflection`에 저장되어 있다.

## 카드 5 — 실제 자료와 XSS 분리

실제 계획과 검증용 문자열을 섞지 않기 위해 XSS 문자열은 별도 `T06 안전성 검사` 계획에 저장했다.

- 실제 메인 계획: 오늘 ALEPH 과제 4~13
- 실제 메인 할 일: 10개
- 실제 Do: 3건
- 실제 See: 1건
- 안전성 검사 계획: 1건
- 안전성 검사 할 일: `<script>alert("T06")</script>`

`t06/script.js`는 사용자 저장 문자열 출력에 `innerHTML`을 사용하지 않고 `textContent`/form value를 사용한다.

정적 검사:

- t06/script.js JavaScript parse: PASS
- 사용자 데이터 innerHTML assignment: 0
- textContent 사용: 확인
- 대표 secret literal 패턴: 0

## 전체 자료 내보내기

“전체 자료 JSON 내보내기” 버튼은 모든 plan ID의 server state를 다시 읽고 JSON 파일 하나로 생성한다.

## Git 비밀값 검사

저장소 최근 100개 commit diff를 다음 대표 패턴으로 검사했다.

- GitHub token
- `sb_secret_`
- OpenAI style `sk-`
- AWS AKIA
- Google AIza
- private key header
- password/api_key/access_token/secret 인라인 값 할당

결과: **100개 commit diff에서 일치 0건**

## 공개 접근

- T06 URL: HTTP 200
- Password Protection: OFF
- SSO Protection: OFF
- Trusted IP Protection: OFF
- `t06/script.js`: HTTP 200
- `contracts/pds-schema-v2.json`: HTTP 200

## 공개 Edge Function 실제 호출

Vercel `/api/t06-probe`에서 실제 공개 Edge Function에 POST 요청했다.

응답:

- HTTP 200
- ok = true
- timezone = Asia/Seoul
- today = 2026-10-08
- plans = 2
- active plan tasks = 10
- executions = 3
- revisions = 1
- reflections = 1
- summary = plan_count 10 / completed 2 / delayed 0 / blocked 2 / expected 0 / actual 106 / difference 106

## 디자인 통합

T05와 T06은 루트 과제 홈의 베이지/주황 디자인이 아니라 **T02·T03·T04의 과제 결과물 다크/청록 디자인**으로 통일했다.

- background: dark navy `#0e1115`
- surface: charcoal panels `#161b22` / `#1d242d`
- accent: teal `#77d7e5`
- T02~T04처럼 간결한 헤더, 어두운 카드, 상태 pill, 과제 홈 돌아가기 링크
- 모바일 반응형

기능/DB/T05 고정 검사는 변경하지 않았다.

## 실제 브라우저에서 마지막 확인할 항목

1. T06 첫 화면에서 `서버 DB 연결됨` 표시
2. 메인 계획 `오늘 ALEPH 과제 4부터 13까지 완료 도전`과 과제 4~13 10개 표시
3. Ctrl+R 후 ID·날짜·값·단위 동일 복원
4. 화면의 **안전성 검사** 구역에서 서버 DB의 `<script>alert("T06")</script>`가 실행되지 않고 글자 그대로 표시
5. 전체 자료 JSON 내보내기 파일 다운로드
6. DevTools Console 빨간 오류/비밀값 원문 0건

## 추가 정리 사항 (2026-10-08)

- 초기 임시 테스트용 `T06 안전성 검사` 계획/할 일은 실제 다이어리에서 제거함
- 보안용 문자열은 `t06_security_checks` 전용 테이블로 분리, 공개 Edge Function `state.security_checks`에서 조회해 `textContent`로 렌더링
- 메인 계획은 2026-10-08 실제 목표 '과제 4~13 완료 도전', 과제 4·5 완료, 과제 6 진행 중, 나머지 7~13 예정
- 임의로 넣었던 예상 90분×10은 제거. 현재 과제별 예상시간 0분은 **미정 상태**이며 사용자 실제 예상값을 입력하는 것이 바람직함
- 과제 4·5·6 Do 3건의 분 수는 Git 커밋으로 확인되는 구간의 분 단위 반올림이며, 개인이 실제로 집중한 순수 소요시간으로 주장하지 않음
- 브라우저 새로고침·내보내기·DB 보안 문자열 렌더링 실제 수동 검증은 사용자 확인 전까지 미확정
