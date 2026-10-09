/* T10 실측값만 전재 · 원본 t10/data/analysis.json · 작성자 limheejae */
window.BRB_STUDY = {
  "title": "정수 원소의 존재 여부 검사에서 컨테이너 종류·크기·조회 위치가 실행 시간에 미치는 영향",
  "author": "limheejae",
  "source_path": "t10/data/analysis.json",
  "environment": "CPython 3.13.5 · Linux · 2026-10-09 · 정수 0…n-1",
  "unit": "ns/조회 · 30블록 중앙값",
  "raw_row_count": 540,
  "per_condition_n": 30,
  "cases": [
    {
      "size": 100,
      "position": "absent",
      "list_median_ns": 506.796,
      "set_median_ns": 17.65,
      "ratio": 28.713,
      "boot_95_pctile_ratio": [
        26.883,
        29.549
      ],
      "set_faster": true,
      "samples_each": 30
    },
    {
      "size": 100,
      "position": "first",
      "list_median_ns": 18.38,
      "set_median_ns": 17.664,
      "ratio": 1.041,
      "boot_95_pctile_ratio": [
        0.994,
        1.064
      ],
      "set_faster": true,
      "samples_each": 30
    },
    {
      "size": 100,
      "position": "last",
      "list_median_ns": 499.839,
      "set_median_ns": 17.831,
      "ratio": 28.032,
      "boot_95_pctile_ratio": [
        27.477,
        29.439
      ],
      "set_faster": true,
      "samples_each": 30
    },
    {
      "size": 1000,
      "position": "absent",
      "list_median_ns": 6066.553,
      "set_median_ns": 18.307,
      "ratio": 331.381,
      "boot_95_pctile_ratio": [
        314.183,
        352.855
      ],
      "set_faster": true,
      "samples_each": 30
    },
    {
      "size": 1000,
      "position": "first",
      "list_median_ns": 17.984,
      "set_median_ns": 17.988,
      "ratio": 1,
      "boot_95_pctile_ratio": [
        0.976,
        1.029
      ],
      "set_faster": false,
      "samples_each": 30
    },
    {
      "size": 1000,
      "position": "last",
      "list_median_ns": 6183.485,
      "set_median_ns": 24.921,
      "ratio": 248.119,
      "boot_95_pctile_ratio": [
        233.67,
        257.548
      ],
      "set_faster": true,
      "samples_each": 30
    },
    {
      "size": 10000,
      "position": "absent",
      "list_median_ns": 64935.154,
      "set_median_ns": 18.132,
      "ratio": 3581.187,
      "boot_95_pctile_ratio": [
        3428.438,
        3782.15
      ],
      "set_faster": true,
      "samples_each": 30
    },
    {
      "size": 10000,
      "position": "first",
      "list_median_ns": 17.954,
      "set_median_ns": 17.585,
      "ratio": 1.021,
      "boot_95_pctile_ratio": [
        0.999,
        1.034
      ],
      "set_faster": true,
      "samples_each": 30
    },
    {
      "size": 10000,
      "position": "last",
      "list_median_ns": 65801.311,
      "set_median_ns": 24.684,
      "ratio": 2665.695,
      "boot_95_pctile_ratio": [
        2564.45,
        2771.057
      ],
      "set_faster": true,
      "samples_each": 30
    }
  ]
};
