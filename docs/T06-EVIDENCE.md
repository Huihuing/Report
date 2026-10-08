# T06 전체 카드 검사 기록

검사 기준일: 2026-10-08 (Asia/Seoul)  
결과물: https://report-huihuing.vercel.app/t06/

## 저장 구조

- 서버 DB: PostgreSQL (Supabase)
- 공개 브라우저 → 공개 Edge Function `t06-pds` → T06 전용 DB 테이블
- 브라우저에서 Supabase Data API 테이블 직접 접근: 사용하지 않음
- `anon`/ `authenticated`의 T06 테이블 직접 권한: 회수
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

## 카드 1 — 계획 세우기

현재 실제 계획:

- 제목: `ALEPH 과제 6 플랜두씨 다이어리 완성`
- 시작: 2026-10-08
- 현재 종료 계획: 2026-10-10
- 우선순위: high
- 성공 기준: 카드 1~5의 Plan→Do→See 흐름 + 실제 기록 + 집계 근거 + 내보내기 + 공개/보안 검증
- 현재 예상 시간: 540분

수정 전 snapshot도 별도 DB 행으로 보존되어 있다.

- 수정 전 종료 계획: 2026-10-09
- 수정 전 예상 시간: 480분
- 수정 전 성공 기준 원문 보존
- 현재 계획 ID는 유지하고 revision 행만 추가

따라서 T06-C04~C08의 DB 구조와 실제 데이터가 존재한다.

## 카드 2 — 할 일 다루기

현재 실제 계획에 지우지 않은 할 일 **6개**가 저장되어 있다.

각 할 일에 다음을 저장한다.

- due_date
- priority
- tags[]
- expected_minutes
- completed / completed_at
- soft delete용 deleted_at

공개 화면에서 다음 동작을 지원한다.

- 만들기
- 고치기
- 완료
- 완료→진행 중 되돌리기
- 지우기
- 제목/태그 검색
- 전체/진행/완료/지연/막힘 필터
- 화면에 공개된 정렬 규칙: 마감일 ASC → priority high/medium/low → created_at ASC

T06-C09~C20의 코드 경로가 연결되어 있다.

## 카드 3 — 실제로 한 일

현재 실행 기록 **3개**가 서버 DB에 저장되어 있다.

모두 다음 필드를 별도 execution row에 저장한다.

- task_id
- started_at
- ended_at
- actual_minutes
- blocker_reason

실행 기록은 계획 row를 수정하지 않는다. 현재 계획 예상 시간은 540분으로 유지되고 실행 기록 실제 시간 합계는 별도 54분이다.

### 완료 중복 방지 실제 DB 검사

검사용 임시 task를 만든 뒤 같은 task에 완료=true를 연속 두 번 적용했다.

결과:

- completed = true
- completion_events = **1**
- completion_cycle = **1**

검사용 task는 검사 후 DB에서 삭제했다.

따라서 버튼 disabled에만 의존하지 않고 DB의 상태 전이 함수 + `unique(task_id, cycle_no)` 제약으로 중복 완료 기록을 막는다.

## 카드 4 — 돌아보기와 다음 계획

현재 실제 T06 계획 DB 집계:

| 항목 | 값 |
|---|---:|
| 계획 수(지우지 않은 할 일 수) | 6 |
| 완료 수 | 3 |
| 지연 수 | 0 |
| 막힘 수 | 2 |
| 예상 시간 | 540분 |
| 실제 시간 | 54분 |
| 차이(실제-예상) | -486분 |
| 실행 기록 | 3건 |
| 돌아보기 | 1건 |

지연은 `completed=false AND due_date < Asia/Seoul today`만 센다.

공개 화면의 집계 숫자는 버튼이며 클릭하면 해당 할 일 필터 또는 실행 기록 구역으로 이동한다.

돌아보기 한 줄:

> 카드 요구사항을 전부 먼저 고정하고, 저장→API→화면→검증 순서로 나눠 각 단계가 끝날 때 실제 데이터로 확인한다.

이 한 줄은 다음 실제 계획 `ALEPH 과제 7 잠금 준비`의 `next_from_reflection` 값으로 저장되어 있다.

## 카드 5 — 실제 자료와 지속성

현재 서버 DB 실제 자료:

- 실제 계획: 2건 (현재 T06 + 돌아보기에서 넘어간 T07 준비)
- 현재 T06 할 일: 6건
- 현재 T06 실행 기록: 3건
- 계획 수정 이력: 1건
- 완료 기록: 3건
- 돌아보기: 1건
- 집계값: 전부 0이 아님

첫 화면에는 다음 문구를 정확히 표시한다.

> 지금은 로그인이 없어 링크를 아는 사람은 누구나 볼 수 있습니다. 남이 봐도 괜찮은 내용만 넣으세요

전체 자료 내보내기는 모든 plan ID의 server state를 다시 읽어서 JSON 파일 하나로 생성한다.

### 스크립트 모양 글자

실제 할 일 제목에 다음 문자열을 DB 저장했다.

`보안 표시 확인: <script>alert("T06")</script>`

`t06/script.js`는 사용자 저장 문자열 출력에 `innerHTML`을 사용하지 않고 `textContent`/form value를 사용한다.

정적 검사:

- t06/script.js JavaScript parse: PASS
- 사용자 데이터 innerHTML assignment: 0
- textContent 사용: 확인
- 현재 T06 source의 대표 secret literal 패턴: 0

### Git 비밀값 검사

현재 저장소 최근 100개 commit diff를 다음 대표 패턴으로 검사했다.

- GitHub token
- `sb_secret_`
- OpenAI style `sk-`
- AWS AKIA
- Google AIza
- private key header
- password/api_key/access_token/secret의 인라인 값 할당

결과: **100개 commit diff에서 일치 0건**

이 검사는 모든 가능한 비밀 형식을 수학적으로 증명하는 검사는 아니지만, 제출용 대표 secret 원문 점검으로 사용한다.

## 공개 접근

- Vercel T06 URL: HTTP 200
- Password Protection: OFF
- SSO Protection: OFF
- Trusted IP Protection: OFF
- `t06/script.js`: HTTP 200
- `contracts/pds-schema-v2.json`: HTTP 200

## 공개 Edge Function 실제 호출

Vercel의 `/api/t06-probe`가 공개 Supabase Edge Function에 실제 POST 요청을 보내고 결과를 축약해 반환하도록 검사했다.

실제 응답:

- HTTP 200
- ok = true
- timezone = Asia/Seoul
- today = 2026-10-08
- plans = 2
- active plan tasks = 6
- executions = 3
- revisions = 1
- reflections = 1
- summary = plan_count 6 / completed 3 / delayed 0 / blocked 2 / expected 540 / actual 54 / difference -486

따라서 공개 Edge Function → 서버 DB 조회 경로는 실제 배포에서도 동작한다.

## 실제 브라우저에서 마지막 확인할 항목

아래는 브라우저 JS 실행/다운로드가 필요해 자동 정적 검사만으로 확정하지 않는다.

1. T06 첫 화면에서 `서버 DB 연결됨` 표시와 실제 DB 값 표시
2. Ctrl+R 후 ID·날짜·값·단위가 동일하게 복원
3. `<script>alert("T06")</script>`가 실행되지 않고 글자 그대로 표시
4. 전체 자료 JSON 내보내기 파일 다운로드
5. DevTools Console 빨간 오류와 비밀값 원문 0건
