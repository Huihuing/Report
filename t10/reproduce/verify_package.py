#!/usr/bin/env python3
"""T10 no-network, read-only original experiment consistency test."""
import csv
import json
import statistics
from collections import defaultdict
from pathlib import Path
HERE=Path(__file__).resolve().parents[1]
with (HERE/'data/raw_measurements.csv').open(encoding='utf-8',newline='') as file:
    rows=list(csv.DictReader(file))
assert len(rows)==540, f'expected 540 rows, got {len(rows)}'
assert {int(x['size']) for x in rows}=={100,1000,10000}
assert {x['position'] for x in rows}=={'absent','first','last'}
assert {x['container'] for x in rows}=={'list','set'}
assert {int(x['run']) for x in rows}==set(range(1,31))
groups=defaultdict(list)
for row in rows:
    assert 0 < int(row['loops']) <= 500_000
    assert float(row['elapsed_seconds'])>0
    ns=float(row['ns_per_lookup'])
    assert abs(ns-float(row['elapsed_seconds'])/int(row['loops'])*1e9)<0.003
    groups[(int(row['size']),row['position'],row['container'])].append(ns)
assert len(groups)==18 and all(len(vals)==30 for vals in groups.values())
analysis=json.loads((HERE/'data/analysis.json').read_text(encoding='utf-8'))
assert len(analysis['cases'])==9
for record in analysis['cases']:
    size,pos=record['size'],record['position']
    for container in ['list','set']:
        got=round(statistics.median(groups[(size,pos,container)]),3)
        assert abs(got-record[container+'_median_ns'])<=0.0011
    ratio=statistics.median(groups[(size,pos,'list')])/statistics.median(groups[(size,pos,'set')])
    assert abs(ratio-record['ratio'])<0.0011
for size in [100,1000,10000]:
    rec=next(r for r in analysis['cases'] if r['size']==size and r['position']=='absent')
    assert rec['set_faster'] and rec['ratio']>1
assert analysis['hypotheses']['H1_set_faster_for_absent_at_all_sizes']
assert (HERE/'paper.md').is_file() and (HERE/'reproduce/run_benchmark.py').is_file()
print('VERIFY_OK 540 raw measurements; 18 groups x 30; 9 summary rows; H1 supported; paper/script present')
