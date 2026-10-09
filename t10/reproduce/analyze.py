#!/usr/bin/env python3
"""Recompute all T10 results from recorded measurements without rerunning the benchmark."""
import argparse
import csv
import json
import random
import statistics
from collections import defaultdict
from pathlib import Path

SEED=20261009

def analyze(input_csv,output_json):
    groups=defaultdict(list)
    with Path(input_csv).open(encoding='utf-8',newline='') as f:
        rows=list(csv.DictReader(f))
    for r in rows:
        key=(int(r['size']),r['position'],r['container'])
        groups[key].append(float(r['ns_per_lookup']))
        assert int(r['loops']) > 0
        assert float(r['elapsed_seconds'])>0
        assert r['expected_found']==str(r['position']!='absent').lower()
    assert len(rows)==540 and len(groups)==18
    assert all(len(x)==30 for x in groups.values())
    conditions=[]
    for n in [100,1000,10000]:
        for position in ['absent','first','last']:
            li=groups[(n,position,'list')]; se=groups[(n,position,'set')]
            lmedian=statistics.median(li); smedian=statistics.median(se)
            rng=random.Random(SEED+n+sum(map(ord,position)))
            boot=[]
            for _ in range(2000):
                bl=statistics.median(rng.choices(li,k=len(li)))
                bs=statistics.median(rng.choices(se,k=len(se)))
                boot.append(bl/bs)
            boot.sort()
            conditions.append({'size':n,'position':position,
                'list_median_ns':round(lmedian,3),'set_median_ns':round(smedian,3),
                'ratio':round(lmedian/smedian,3),
                'boot_95_pctile_ratio':[round(boot[49],3),round(boot[1949],3)],
                'set_faster':smedian<lmedian,'samples_each':30})
    hypotheses={'H1_set_faster_for_absent_at_all_sizes':all(c['set_faster'] for c in conditions if c['position']=='absent'),
                'absent_list_100_to_10000_scale':round(next(c['list_median_ns'] for c in conditions if c['size']==10000 and c['position']=='absent')/next(c['list_median_ns'] for c in conditions if c['size']==100 and c['position']=='absent'),3),
                'absent_set_100_to_10000_scale':round(next(c['set_median_ns'] for c in conditions if c['size']==10000 and c['position']=='absent')/next(c['set_median_ns'] for c in conditions if c['size']==100 and c['position']=='absent'),3)}
    output={'raw_row_count':len(rows),'per_condition_n':30,'cases':conditions,'hypotheses':hypotheses,
            'inference_scope':'descriptive; bootstrap resampling captures variation among rounds in this one run only'}
    Path(output_json).write_text(json.dumps(output,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print('ANALYSIS_OK rows=540 comparisons=9 H1='+str(hypotheses['H1_set_faster_for_absent_at_all_sizes']))
    return output

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--raw',default='data/raw_measurements.csv');parser.add_argument('--out',default='data/analysis.json');a=parser.parse_args();analyze(a.raw,a.out)
