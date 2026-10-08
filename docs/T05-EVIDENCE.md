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

## AI B

- 시작 SHA: 862c182eaa96a3e5983cee1e37c28467c039ed60
- 구현 종료 SHA: 97c04ba273ff1f5507ef72e431e38a7a53eb2d0e
- 작업시간: 32.71분 / 45분
- 요청·도구 호출: 19 / 20
- 검사 결과: 10 / 10 PASS
- 오류 회차: 0회
- 고정 검사 삭제: 0건
- 고정 검사 완화: 0건
- 기대값 변경: 0건

AI B 결과의 F10 실측은 실패 회차 16 PASS / 1 FAIL 뒤 정본 재실행 17 PASS / 0 FAIL이다.

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
| AI B | 32.71분 | 19 | 0 | 10/10 | 862c182e… | 97c04ba2… |

모델/서비스 이름은 공개 비교 구간에서 표시하지 않는다.

## 도구 선택 기준

새 대화가 문서만 보고 재현해야 하는 작업은 실행 명령·테스트·버전 근거를 저장소에 남기기 쉬운 도구를 먼저 선택하고, 빠른 수정만 필요한 작업은 호출 수와 작업시간이 더 적은 도구를 우선한다.

## C39 상태

AI B가 다른 채팅에서 작업한 사실은 기록되어 있으나, 과거 대화와 저장소 어디에도 AI B의 실제 모델 또는 서비스명이 명시되어 있지 않다.

따라서 **AI A와 AI B가 서로 다른 모델 또는 서비스였는지는 현재 증거만으로 판정하지 않는다.**
모델/서비스명을 추측하거나 임의로 기입하지 않는다.
