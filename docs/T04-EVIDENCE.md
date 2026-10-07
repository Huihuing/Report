# T04 전체 카드 및 정본 조건 검사 기록

검사 기준일: 2026-10-07 (Asia/Seoul)  
결과물: https://report-huihuing.vercel.app/t04/

## 정본 package 확인

- package_id: `aleph-t04-real-information-board-public-contract-v2`
- contract_version: `2.0.0`
- fixture contract: `1.1.0`
- 정본 registry: T04-C01 ~ T04-C35, 총 35개
- 업로드 ZIP의 17개 manifest-listed 파일을 실제로 추출해 bytes/SHA-256을 대조했고 전부 manifest와 일치했다.
- `asset-manifest.json`은 자기 자신을 목록에서 제외하며, 업로드 파일 자체 SHA-256은 `8adc0f6caea09e45c8fcdd42e239653e942227e306f688c780a18d441a6b7b41`이었다.
- 공개 심사 화면에서는 README.md / public-contract.json / asset-manifest.json의 SHA-256을 브라우저 Web Crypto로 다시 계산하는 버튼을 제공한다.

주요 manifest 값:

- README.md: `b9d0d4c076f8c1e1d9faf1a42d5bea42b0c47e5018e8f46af31f3798adc8d80c`
- public-contract.json: `647d2ea2ce97005aebcbe9ccd62f380bc6efb10967729464bb1df67b3588edeb`
- recover-d2.json: `fecab12b34fac4d7c053083bad220748fceca88f91e2b5a024907a34e6620b04`

## 카드 1 — 실제 공개 원천

선택 값: **서울 2m 현재 기온**  
실제 공개 원천: Open-Meteo Forecast API  
호출 경로: `/api/t04-live` → 서버에서 공개 Open-Meteo URL 조회  
비밀키: 사용하지 않음  
기준 시간대: Asia/Seoul

### 2026-10-07 실제 기록 #1

- signal_id: `seoul.temperature_2m`
- source_url: `https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780&current=temperature_2m&timezone=Asia%2FSeoul`
- source_observed_at: `2026-10-07T19:00:00+09:00`
- server_created_at / fetched_at: `2026-10-07T10:14:24.186Z` = 2026-10-07 19:14:24 KST
- normalized_value: `17.6`
- unit: `°C`
- record_date: `2026-10-07`

원자료:
```json
{
  "latitude": 37.55,
  "longitude": 127,
  "timezone": "Asia/Seoul",
  "timezone_abbreviation": "GMT+9",
  "current_units": {
    "time": "iso8601",
    "temperature_2m": "°C"
  },
  "current": {
    "time": "2026-10-07T19:00",
    "interval": 900,
    "temperature_2m": 17.6
  }
}
```

저장값 `17.6 °C`와 공개 화면 표시값은 같은 record를 사용한다.

## 카드 2 — 비밀 없는 호출

- Open-Meteo 공개 API는 API Key 없이 호출한다.
- 공개 브라우저는 같은 origin의 `/api/t04-live`만 호출한다.
- server function에도 API key/secret 환경변수를 두지 않는다.
- 실제 응답에는 값/단위/출처/시각/좌표 등 공개 날씨 정보만 포함한다.
- 제출 직전 Git 전체에서 대표 secret 패턴을 다시 검색한다.

## 카드 3 — 다섯 합성 실패

실패 버튼은 항상 다음 기준 상태를 먼저 만든다.

1. reset
2. T04-NORMAL-D1-A → 100 pt, 행 1개
3. T04-NORMAL-D1-B → 105 pt, 같은 record ID, 행 1개
4. 선택한 실패 fixture

그 뒤 다음 상태를 표시한다.

| fixture | freshness | error_code | 마지막 정상값 | 행 |
|---|---|---|---:|---:|
| T04-TIMEOUT | stale | timeout | 105 pt | 1 |
| T04-AUTH-401 | stale | auth | 105 pt | 1 |
| T04-RATE-429 | stale | rate_limit | 105 pt | 1 |
| T04-OFFLINE | stale | offline | 105 pt | 1 |
| T04-SCHEMA-BREAK | stale | schema_error | 105 pt | 1 |

각 상태는 서로 다른 원인 설명과 다음 행동 문구를 사용한다. 실패는 current_reading과 daily_readings를 지우거나 덮어쓰지 않는다.

### 복구

실패 상태에서 공개 asset `T04-RECOVER-D2`를 다시 시도하면:

- freshness = fresh
- error_code = none
- 행 = 2
- 다음 합성 날짜 신규 행 = 정확히 1
- 저장값 = 120 pt
- 전일 대비 magnitude = 15 pt

## 카드 4 — 하루 한 줄

공개 화면의 정상 sequence 버튼은 다음 순서로 재생한다.

1. T04-NORMAL-D1-A
2. T04-NORMAL-D1-B
3. T04-NORMAL-D1-B 한 번 더
4. T04-NORMAL-D2

같은 `signal_id + record_date`는 같은 record ID를 갱신하므로 합성 1일차 성공 3회 뒤에도 행은 1건이다. 다음 합성 날짜 성공 뒤에만 행이 2건이 된다.

## 카드 5 — 실제 이틀

정본 계약은 fixture D1/D2가 실제 날짜 증거를 대신하지 못한다고 명시한다.

현재 실제 기록:

1. 2026-10-07 — 17.6 °C — 보존 완료
2. **다음 실제 KST 날짜 대기**

따라서 현재 상태:

- T04-C22: NOT YET — 실제 날짜 기록 1/2
- T04-C23: NOT YET — 두 번째 실제 기록이 아직 없음
- T04-C24: NOT YET — 실제 두 값의 어제 대비 재계산은 둘째 날 뒤 가능

다음 KST 날짜가 되기 전 두 번째 값을 임의 생성하거나 합성 fixture로 대체하지 않는다.

## 추가 정본 조건 C29~C35

- C29~C33: 결과물·소스 URL을 인증/초대/비밀번호/OAuth/CAPTCHA 없이 공개한다.
- C34: 결과물 제출 필드에는 HTTPS URL 1개만 사용한다.
- C35: 소스 제출 필드에는 HTTPS URL 1개만 사용하고 40자리 소문자 full commit SHA를 포함한다.
