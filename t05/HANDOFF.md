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
- AI A 실제 작업시간: **3.78분 / 상한 45분**
- AI A 요청·도구 호출: **10회 / 상한 20회**
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

현재 T04 공개 화면의 기존 `verifyPackageHashes()`는 3개 하드코딩 hash만 검사하며 새 `package-integrity.mjs`의 17개 전체 verifier를 아직 사용하지 않습니다. 또한 실패 결과 뒤 정본 재실행 시 결과 영역을 새 run 기준으로 확실히 초기화하고 17 PASS / 0 FAIL을 표시하는 UI 연결이 필요합니다.

## 6. 다음 행동

1. `t04/script.js`의 기존 3-file `PACKAGE_HASHES` / `verifyPackageHashes()` 경로를 새 `t04/package-integrity.mjs` verifier와 연결합니다.
2. 공개 버튼 한 번으로 `assets/asset-manifest.json`을 읽고 manifest-listed 17개를 모두 검사합니다.
3. 각 결과에 PASS, MISSING, FETCH_ERROR, BYTES_MISMATCH, SHA_MISMATCH를 표시하고 manifest 오류도 별도 표시합니다.
4. 매 검사 시작 시 이전 결과 DOM과 집계 상태를 초기화합니다.
5. 실패 합성 입력 → 정본 재실행 흐름을 확인해 T05-F10을 PASS로 만듭니다.
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
