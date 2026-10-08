# T05 최종 감사 기록

검사 기준일: 2026-10-08 (Asia/Seoul)

## 고정 조건

- 개선 대상: T04 공개 fixture package 17개 파일 전체 무결성 검사
- 고정 검사: T05-F01 ~ T05-F10, 정확히 10개
- 공통 시간 상한: 45분 / AI
- 공통 요청·도구 호출 상한: 20회 / AI
- 같은 최초 요청: t05/initial-request.md
- 고정 검사 원본: t05/fixed-tests.json

## 작업 순서

1. AI A 시작
2. AI A 종료·인수인계
3. AI B 시작
4. AI B 종료

work-log.json의 order와 실제 기록 순서가 위 순서와 일치한다.

## AI A

- 시작 SHA: 59cc76327d73c8336444c8643e1d5e02a2cab655
- 구현 종료 SHA: 8a5b3526fd27e14e91b8c5b640f20bedbcae739d
- 작업시간: 6.70분 / 45분
- 요청·도구 호출: 18 / 20
- 검사 결과: 9 / 10 PASS
- 오류 회차: 1회
- FAIL: T05-F10

## 인수인계

HANDOFF.md에 다음 7항목이 있다.

1. 목표
2. 현재 상태
3. 실행 명령
4. 통과 검사
5. 남은 문제
6. 다음 행동
7. 건드리지 말 것

HANDOFF.md의 현재 Git blob SHA는 `72e67ba579308c0a5860c712f9a1e104d360a9e2`이다.
AI B 시작 HEAD `862c182eaa96a3e5983cee1e37c28467c039ed60`에서의 HANDOFF.md도 같은 blob SHA이므로 AI A가 남긴 내용과 AI B가 받은 내용이 동일하다.

HANDOFF가 가리키는 AI A 구현 코드 SHA `8a5b3526fd27e14e91b8c5b640f20bedbcae739d`는 실제 Git commit으로 존재한다. 이후 B 시작 HEAD까지 추가된 것은 A 결과/인수인계/사용량 봉인 기록이며 T04 개선 코드 기준 SHA는 위 구현 commit이다.

## 최종 AI B

최종 판정용 AI B는 AI A와 다른 모델로 새 대화에서 수행했다.

- 모델 표기: GPT-6 Sol (사용자가 해당 세션에서 선택한 모델 표기)
- 이전 대화 전문 사용: 없음
- 시작 SHA: 51723acd54106289b6088e8cb4c16083214cb562
- 코드 수정 종료 SHA: 9aa7f16d07b1c23b25b0b9409da22d032597eb3b
- 최종 기록 commit: e1667ea007b6b7133bc3d8f903a970f2395c05e8
- 작업시간: 3.42분 / 45분
- 요청·최상위 도구 호출: 11 / 20
- GitHub API 내부 호출: 15회 (상한 판정용 요청·도구 호출 수와 분리 기록)
- 검사 결과: 10 / 10 PASS
- **카드 C25 정의의 오류 회차: 0회**
- 별도 운영 오류: 도구 요청 1회 거절 후 복구
- 고정 검사 삭제: 0건
- 고정 검사 완화: 0건
- 기대값 변경: 0건
- 결과 파일: `t05/ai-b-final-gpt6-sol-2026-10-08.json`

최종 AI B는 같은 개선 범위 안에서 실제 코드도 수정했다.

1. `t04/package-integrity.mjs`: manifest.files에 null/array 같은 객체가 아닌 항목이 있어도 예외 대신 MANIFEST_ERROR 처리
2. `t04/package-integrity.js`: 브라우저 검증기에도 동일 방어 적용

기존 고정 검사 T05-F01~F10은 수정하지 않고 10/10 PASS였고, 추가 회귀 검사 2개(null/array malformed entry)도 PASS였다.

이전에 GPT-5.6 Sol로 수행된 AI B 기록은 예비 continuation으로 보존하지만, T05-C39의 최종 판정용 AI B에는 사용하지 않는다.

## 실제 T04 package 17파일 사후 감사

정본 ZIP `t04-real-information-board-public-v1.zip`과 저장소의 manifest-listed 17개 파일을 bytes 및 Git blob SHA 기준으로 대조했다.

결과: **17 / 17 원본과 일치**

특히 누락되었던 다음 정본 파일도 원본 바이트로 복원했다.

- adapter-reset.example.js — 7702 bytes, Git blob `abc6f758deac550213668fc326314e18b7bf8a20`
- criterion-registry.json — 14360 bytes, Git blob `02cd63f353861575746d4e94a468cb8602c59855`
- fixture-manifest.json
- fixture.schema.json
- normalized-reading.schema.json
- reading-status.schema.json

## 가린 비교

| 구분 | 작업시간 | 요청/호출 | 오류 회차 | 통과 수 | 시작 SHA | 종료 SHA |
|---|---:|---:|---:|---:|---|---|
| AI A | 6.70분 | 18 | 1 | 9/10 | 59cc7632… | 8a5b3526… |
| AI B | 3.42분 | 11 | 0 | 10/10 | 51723acd… | 9aa7f16d… |

오류 회차는 **고정 검사 10개를 실행한 회차 중 하나 이상의 FAIL이 나온 회차 수**로 계산한다. AI B의 도구 요청 거절 1회는 이 오류 회차에 포함하지 않는다.

모델/서비스 이름은 공개 비교 구간에서 표시하지 않는다.

## 도구 선택 기준

새 대화가 문서만 보고 재현해야 하는 작업은 실행 명령·테스트·버전 근거를 저장소에 남기기 쉬운 도구를 먼저 선택하고, 빠른 수정만 필요한 작업은 호출 수와 작업시간이 더 적은 도구를 우선한다.

## C39 상태

- AI A: GPT-5.6 Sol
- 최종 AI B: GPT-6 Sol (사용자가 해당 세션에서 선택한 모델 표기)
- 최종 AI B 결과 JSON은 모델 표기, 이전 대화 전문 미사용, 시작/종료 SHA, 사용량과 10/10 결과를 보존한다.

따라서 **T05-C39 PASS — AI B는 AI A와 다른 모델을 사용했다.**

런타임 내부 세부 빌드명은 별도로 검증하지 않았으며, 저장소에는 사용자가 실제 세션에서 선택한 제품 모델 표기를 기록한다.
