# AGENTS.md

## 저장소 목적

이 저장소는 ALEPH Studio 과제 결과물을 한곳에서 관리합니다.

- T01 결과물은 저장소 루트(`/`)에 둡니다.
- T02부터는 과제 번호별 하위 폴더를 사용합니다.
  - `/t02/`
  - `/t03/`
  - `/t04/`
  - 이후도 같은 규칙을 따릅니다.
- 새 과제를 추가하면 루트 T01 페이지의 "ALEPH 과제" 영역에서도 해당 과제로 이동할 수 있게 링크를 추가합니다.

## Vercel 배포 원칙

Vercel 프로젝트는 반드시 기존 `report` 하나만 사용합니다.

- production base URL: `https://report-huihuing.vercel.app/`
- T01: `https://report-huihuing.vercel.app/`
- T02: `https://report-huihuing.vercel.app/t02/`
- T03: `https://report-huihuing.vercel.app/t03/`
- 이후 과제도 같은 도메인 아래 하위 경로로 배포합니다.
- 과제별로 별도 Vercel 프로젝트를 새로 만들지 않습니다.
- 별도 Vercel 프로젝트가 이미 존재하더라도 제출 URL에는 사용하지 않습니다.
- Vercel Authentication, Password Protection 등 로그인 또는 권한 요구 설정을 켜지 않습니다.
- 배포 후 공개 URL이 무로그인 상태에서 HTTP 200으로 열리는지 확인합니다.

## GitHub/제출 원칙

- 소스는 `Huihuing/Report` 저장소 하나에서 관리합니다.
- 제출용 소스 URL은 브랜치/저장소 첫 화면이 아니라 해당 제출 시점의 full commit URL을 사용합니다.
- full commit SHA는 40자리 소문자 SHA를 그대로 사용합니다.
- 새 작업으로 커밋이 추가되면 제출 직전 최신 full commit URL을 다시 확인합니다.

## 구현 원칙

- 과제 본문과 카드의 통과 기준에 필요한 기능을 우선 구현합니다.
- 아직 공개되지 않은 다음 카드 조건을 추측해서 과도하게 구현하지 않습니다.
- 기존 과제 결과물을 깨뜨리지 않도록 과제별 파일을 분리합니다.
- 개인정보, 비밀번호, API Key, 토큰, 쿠키, 비밀 환경변수 등 공개 금지 정보를 저장소에 넣지 않습니다.
- 외부 저작물은 공개 권한이 명확하지 않으면 포함하지 않습니다.

## 현재 구조

```text
/
├─ index.html        # T01 + 과제 허브
├─ styles.css
├─ script.js
├─ t02/
│  ├─ index.html     # T02 Gate Sprint 30
│  ├─ styles.css
│  └─ script.js
├─ t03/
│  ├─ index.html     # T03 짤·카드 스튜디오
│  ├─ styles.css
│  └─ script.js
├─ docs/
└─ AGENTS.md
```

이 규칙은 이후 ALEPH 과제 작업에서도 계속 유지합니다.
