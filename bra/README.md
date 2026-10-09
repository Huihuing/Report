# BR-A · 나를 소개하는 사이트와 재생성 장치

작성자: 임희재 / 기준일: 2026-10-09

## 1. 공개 사이트

- https://report-huihuing.vercel.app/bra/
- 이름과 `…한 사람`으로 끝나는 한 줄 소개, 실제 리추얼 장면에 기반한 자기소개, 세 능력(자기조절력·대인관계력·자기동기력), 출처가 있는 숫자, T10 논문과 T13 예정 공간, 이력서·자기소개서·경력기술서가 있습니다.
- **T11 비공개 장편소설 원문은 어느 공개 파일에도 넣지 않습니다.** 2025년 경험과 2026년 리추얼의 확인 가능한 부분만 공개했습니다.
- 출석 기록은 전달받지 못하여 출석률/출석 일수를 산출하지 않았습니다. 리추얼 날짜 수를 출석으로 대체하지 않습니다.
- 개인 연락용 전화번호·이메일 대신 사용자가 공개하는 GitHub 프로필 `@Huihuing`을 연락 경로로 소개합니다.

## 2. 재현 장치 실행 (Python 3.10+, 외부 패키지 설치 불필요)

이 ZIP 내부에서 다음 세 단계를 그대로 진행합니다.

1. `python tools/update.py --ritual inputs/ritual_safe.json --assignments inputs/assignments.json --attendance inputs/attendance.json --approved inputs/approved.json --out outputs`
2. `outputs/published.json`과 `outputs/candidates.json`, `outputs/review.md` 확인 (기본 승인된 후보 0건이므로 공개 문장은 추가되지 않음).
3. 공개할 문장은 `inputs/approved.json`의 `approved_candidate_ids`에 검토한 후보 ID를 추가하고 다시 1번을 실행합니다. 생성된 `outputs/published.json`을 웹 프로젝트 `bra/data/published.json`에 반영해 배포하면 숫자와 승인 문장만 갱신됩니다.

입력 파일 설명:

- `ritual_safe.json`: 본인이 남긴 날짜별 리추얼의 **자기 경험 필드와 자기평가만** 발췌·보존. 동료 이름·동료 발언·개인 연락처 제외.
- `assignments.json`: T01~T11 과제 산출물 목록. 승인 점수나 제출 성공 건수가 아님.
- `attendance.json`: 실제 출석 원본 미제공으로 `attended_days: null`. 출석 데이터를 받았을 때만 출처와 수치를 입력.
- `approved.json`: 사용자가 확인 후 공개를 선택한 후보의 ID 목록. 기본값은 빈 목록이므로 AI 후보를 자동 공개하지 않음.

전체 원본 리추얼 JSON도 동일한 구조인 `days[].open`/`days[].close`를 갖기 때문에 `--ritual`에 사용할 수 있지만, **원본 JSON은 개인정보를 포함할 수 있으므로 공개 저장소에 커밋하면 안 됩니다.** 실행 장치는 동료 평가를 후보 생성에 사용하지 않습니다. 출처와 날짜가 붙은 1인칭 일화에서만 제안을 만듭니다.

## 3. 새로운 기록 반영 방식

새 날짜를 `inputs/ritual_safe.json`에 같은 구조로 추가 → 1번 명령 재실행 → `outputs/`의 지표와 검토 대상 자동 재계산 → 공개할 항목만 `approved_candidate_ids`로 명시 → 두 번째 재실행 → 사이트 `bra/data/published.json` 갱신 → 동일 Vercel 프로젝트 배포.

장치는 **AI API를 호출하지 않습니다.** 동일 입력·동일 코드면 동일 파일 바이트가 생성되며, 승인되지 않은 신규 후보는 공개 JSON에 포함되지 않습니다. 새 장면의 강점 분류는 단어 기반 후보이므로 정답/진단이 아니고 사람의 검토가 필요합니다.

## 4. 같은 입력 두 번 실행 + 새 폴더 검증

```bash
python tests/test_update.py
```

실행 환경에서 실험 입력을 임시 폴더로 복사한 뒤 독립 폴더 두 곳에 재생성하고 3개 결과 파일을 SHA-256으로 비교합니다. 새 날짜로 입력을 변경하면 지표가 변화하는지, 승인 전에는 새 문장이 공개되지 않는지, 승인한 ID만 공개되는지도 검사합니다.

## 5. 제출 파일 구성

- `README.md` — 바로 실행하는 3단계 / 데이터 출처와 제한
- `docs/resume.md`, `docs/cover_letter.md`, `docs/experience.md` — 이력서 / 자기소개서 / 경력기술서
- `tools/update.py` — 재생성 장치 실행 소스
- `tests/test_update.py` — 결정성·보호 경계 검증
- `inputs/` — 동료 실명 없는 근거 입력(원본 대신 비식별 최소 자료)
- `outputs/` — 최근 생성 지표·후보·검토본
- `site/` — 공개 웹페이지의 원본과 공개 가능한 결과 JSON
- `MANIFEST_SHA256.txt` — 파일 해시 목록

## 6. 검토가 필요한 범위

면접·개발 과정의 사실성은 T09와 날짜별 기록에서 확인 가능한 범위만 사용했습니다. 소설의 장면 묘사는 포함하지 않았습니다. 출석 기록, 실제 프로젝트 최종 승인 현황, 13번 앱은 제공된 자료에 없으므로 단정하지 않았습니다. 홈페이지의 첫 문장과 마지막 문장은 현재 편집 초안이므로, 실제 입사지원에 쓰기 전 본인이 읽고 승인·수정해야 합니다.

**공개 저장소와 제출 ZIP의 차이:** `bra/tools/`은 공개할 수 있지만, 사용자의 날짜별 자기 기록 원본 및 비식별화된 입력 파일은 ZIP에서만 제공합니다. 공개 재생성 코드를 실행하려면 ZIP의 `inputs/`과 `tests/`를 함께 사용합니다.
