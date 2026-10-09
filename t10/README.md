# T10 — 재현 패키지

**제출 ZIP에는 완성 논문 `paper.md` 한 편, 원자료, 분석 결과, 실험·분석·검증 코드를 모두 포함합니다.** 추가 설치나 회원가입은 필요하지 않습니다.

## 바로 확인하기

```bash
python reproduce/verify_package.py
```

출력 예상: `VERIFY_OK 540 raw measurements; 18 groups x 30; 9 summary rows; H1 supported; paper/script present`

## 보관된 원자료 재분석(측정값 그대로)

```bash
python reproduce/analyze.py --raw data/raw_measurements.csv --out data/analysis-check.json
```

## 처음부터 다시 실험하기

```bash
python reproduce/run_benchmark.py --out rerun_data
python reproduce/analyze.py --raw rerun_data/raw_measurements.csv --out rerun_data/analysis.json
```

새 실행은 반드시 `rerun_data`처럼 별도 폴더를 지정하세요. **새 머신·시점의 절대 실행시간은 달라질 수 있습니다.** Python 3.10 이상 표준 라이브러리만 사용합니다.

## 구성

- `paper.md`: 표지·초록·서론·방법·결과·논의·결론·참고문헌·재현 방법이 있는 완성 논문
- `data/raw_measurements.csv`: 실제 실행으로 얻은 540개의 측정 블록 전량
- `data/summary.csv`: 3개 크기 × 3개 조건별 중앙값 요약
- `data/analysis.json`: 재계산한 요약과 재표집 구간 및 가설 판정
- `data/environment.json`: 실제 실행 시점의 Python·플랫폼·파일럿 반복 수
- `reproduce/run_benchmark.py`: 전체 실험 실행 코드
- `reproduce/analyze.py`: 원자료 재분석 코드
- `reproduce/verify_package.py`: 제출 데이터·논문 존재와 수치 일치 검사
- `figures/membership_lookup.svg`: 측정 결과 시각화
- `MANIFEST_SHA256.txt`: 파일 해시 검증 목록

## 연구의 정직성

데이터는 공개 서버에서 수집한 통계가 아니라 **Python 코드로 실제 생성한 입력**을 검색해 얻은 실행시간입니다. 30회 × 18조건 = 540개 블록을 모두 포함했습니다. 파일럿과 워밍업 결과만 제외했습니다. 가설을 지지하지 않는 조건 역시 `paper.md`와 원자료에 그대로 남겼습니다.

## 안전한 공개 원칙

실제 개인정보, 비밀번호, 토큰, API 비밀값, 연구 참여자 개인정보는 포함하지 않았습니다. 소스는 CPython 기본 내장 자료구조에 대한 합성 입력 성능 실험입니다.
