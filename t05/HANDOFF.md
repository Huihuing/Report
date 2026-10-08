# T05 AI A → AI B 인수인계

인수인계 기준 코드 버전: `8a5b3526fd27e14e91b8c5b640f20bedbcae739d`

AI B에는 이 저장소와 이 문서만 제공합니다. 첫 대화 전문은 제공하지 않습니다.  
고정 검사 원본은 `t05/fixed-tests.json`, 동일 최초 요청은 `t05/initial-request.md`입니다.

## 1. 목표

T04 공개 fixture package의 `asset-manifest.json`에 등록된 **17개 파일 전체**를 bytes와 SHA-256으로 검사하고, MISSING / FETCH_ERROR / BYTES_MISMATCH / SHA_MISMATCH / manifest 형식 오류를 구분해 공개 화면에 표시합니다. 실패 뒤 정본 package를 다시 검사하면 이전 실패 표시가 남지 않고 17 PASS / 0 FAIL로 복구되어야 합니다.

## 2. 현재 상태

- AI A 시작 소스: `59cc76327d73c8336444c8643e1d5e02a2cab655`
- AI A 구현 소스: `8a5b3526fd27e14e91b8c5b640f20bedbcae739d`
- 추가 파일: `t04/package-integrity.mjs`, `t05/run-fixed-tests.mjs`
- 코어 verifier는 manifest hash 형식, self_excluded, 17개 전체 검사, MISSING, FETCH_ERROR, bytes, SHA 불일치를 구분합니다.
- 고정 검사 첫 실행: **9/10 PASS**
- 실패 회차 수: **1회**
- AI A 실제 작업시간: **6.70분 / 상한 45분**
- AI A 요청·도구 호출: **18회 / 상한 20회**
- 새 폴더 재현 시도: 현재 실행 환경에서 GitHub DNS가 차단되어 `git clone`이 실패했습니다. 프로젝트 코드 실패가 아니라 실행 환경 네트워크 제약이며, AI B가 새 환경에서 아래 명령을 실제 재현해야 합니다.
- 기존 T04 실제 날짜 기록·합성 replay 기능은 변경하지 않았습니다.

## 3. 실행 명령

저장소 루트에서 Node.js 20 이상을 사용합니다. 외부 패키지 설치는 필요 없습니다.

```bash
node t05/run-fixed-tests.mjs
```

기대되는 AI A 기준 결과는 `SUMMARY 9/10 PASS`이며 T05-F10 한 건만 FAIL입니다.

공개 T04 확인 경로:

```text
https://report-huihuing.vercel.app/t04/
```

## 4. 통과 검사

현재 PASS:

- T05-F01
- T05-F02
- T05-F03
- T05-F04
- T05-F05
- T05-F06
- T05-F07
- T05-F08
- T05-F09

고정 검사 삭제·완화·기대값 변경은 금지합니다.

## 5. 남은 문제

**T05-F10만 FAIL**입니다.

현재 T04 공개 화면은 manifest를 읽어 17개 항목을 검사하도록 연결되어 있습니다. 다만 브라우저용 `t04/package-integrity.js`와 Node 검사용 `t04/package-integrity.mjs`가 중복되어 있고, 브라우저 쪽은 MISSING / FETCH_ERROR / BYTES_MISMATCH 상태 구분이 Node 코어와 아직 일치하지 않습니다. 고정 러너의 T05-F10도 현재 의도적으로 FAIL로 남아 있어, 실패 결과 뒤 정본 재실행을 실제 검증하는 경로가 필요합니다.

## 6. 다음 행동

1. 브라우저용 `t04/package-integrity.js`와 Node용 `t04/package-integrity.mjs`를 한 동작 기준으로 맞춥니다. 가능하면 중복 로직을 줄입니다.
2. 공개 17개 검사에서 PASS / MISSING / FETCH_ERROR / BYTES_MISMATCH / SHA_MISMATCH와 manifest 오류가 Node 코어와 동일하게 보이게 합니다.
3. 실패 상태를 재현한 뒤 정본 package를 다시 검사하는 결정론 경로를 추가하고, 새 run 시작 시 이전 결과 DOM·집계를 초기화합니다.
4. `t05/run-fixed-tests.mjs`의 T05-F10 하드코딩 FAIL을 실제 실패→정본 재실행 assertion으로 교체합니다. 기대값은 바꾸지 않습니다.
5. 새 작업 폴더에서 `node t05/run-fixed-tests.mjs`를 실행해 재현성을 확인합니다.
6. **같은 `t05/fixed-tests.json` 10개를 그대로 실행**하고 결과를 `t05/ai-b-results.json`에 저장합니다.
7. 완료 후 공개 비교 보고서 `/t05/`와 작업 로그를 완성합니다.

## 7. 건드리지 말 것

- `t05/fixed-tests.json`의 10개 ID·입력·기대값
- `t05/initial-request.md`의 최초 요청과 공통 상한
- T04의 실제 2026-10-07 / 2026-10-08 기록
- `t04/data/live-history.json`의 실제 값
- T04 합성 fixture의 값과 정본 hash
- 기존 Vercel `report` 단일 프로젝트 구조
- T01/T02/T03 기능
