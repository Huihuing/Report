#!/usr/bin/env python3
"""T10 preregistered benchmark: built-in int membership, stdlib only.
Run: python reproduce/run_benchmark.py --out data
No result filtering, no external/network dependencies, fixed seeds.
"""
import argparse
import csv
import json
import os
import platform
import random
import statistics
import sys
import time
import timeit
from pathlib import Path

SIZES = (100, 1000, 10000)
POSITIONS = ('absent','first','last')
KINDS = ('list','set')
REPEATS = 30
SEED = 20261009
TARGET_SECONDS = 0.005
MAX_LOOPS = 500_000


def case_value(n, position):
    return {'absent':-1, 'first':0, 'last':n-1}[position]


def calibrate(t):
    # Calibration data excluded from raw file. Per-condition number chosen to
    # aim for a ~5ms block. Input/batch fixed before the 30 recorded repeats.
    loops = 100
    duration = t.timeit(number=loops)
    if duration <= 0:
        return MAX_LOOPS
    return max(20,min(MAX_LOOPS,int(loops*TARGET_SECONDS/duration)))


def run(out):
    rng = random.Random(SEED)
    out=Path(out); out.mkdir(parents=True,exist_ok=True)
    timers={}
    loops={}
    for n in SIZES:
        lst=list(range(n)); st=set(lst)
        for position in POSITIONS:
            needle=case_value(n,position)
            for kind,obj in [('list',lst),('set',st)]:
                assert (needle in obj) == (position!='absent')
                key=(n,position,kind)
                timer=timeit.Timer('needle in container',globals={'container':obj,'needle':needle})
                timers[key]=timer
                loops[key]=calibrate(timer)
                for _ in range(3): timer.timeit(number=loops[key])  # warm-ups excluded
    rows=[]
    for repetition in range(1,REPEATS+1):
        schedule=list(timers); rng.shuffle(schedule)
        for n,position,kind in schedule:
            key=(n,position,kind)
            seconds=timers[key].timeit(number=loops[key])
            rows.append({'run':repetition,'size':n,'position':position,'container':kind,
                         'loops':loops[key],'elapsed_seconds':f'{seconds:.12f}',
                         'ns_per_lookup':f'{(seconds/loops[key])*1e9:.6f}',
                         'expected_found':str(position!='absent').lower()})
    fields=list(rows[0]); raw=out/'raw_measurements.csv'
    with raw.open('w',encoding='utf-8',newline='') as f:
        wr=csv.DictWriter(f,fields); wr.writeheader(); wr.writerows(rows)
    summaries=[]
    for n in SIZES:
        for position in POSITIONS:
            v={k:[float(row['ns_per_lookup']) for row in rows if row['size']==n and row['position']==position and row['container']==k] for k in KINDS}
            summaries.append({'size':n,'position':position,'n_per_container':REPEATS,
                  'list_median_ns':round(statistics.median(v['list']),3),
                  'set_median_ns':round(statistics.median(v['set']),3),
                  'list_min_ns':round(min(v['list']),3),'set_min_ns':round(min(v['set']),3),
                  'ratio_list_over_set':round(statistics.median(v['list'])/statistics.median(v['set']),3),
                  'set_faster':statistics.median(v['set'])<statistics.median(v['list'])})
    with (out/'summary.csv').open('w',encoding='utf-8',newline='') as f:
        wr=csv.DictWriter(f,list(summaries[0]));wr.writeheader();wr.writerows(summaries)
    env={'captured_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
         'python':sys.version,'implementation':platform.python_implementation(),
         'platform':platform.platform(),'machine':platform.machine(),
         'cpu_count_reported':os.cpu_count(),'repetitions':REPEATS,'sizes':SIZES,
         'positions':POSITIONS,'seed':SEED,'target_batch_seconds':TARGET_SECONDS,
         'pilot_and_warmups_excluded':True,'cases':len(timers),'rows':len(rows),
         'method':'timeit.Timer(stmt, globals).timeit(number=calibrated_loops) / calibrated_loops; 30 rounds, randomized order',
         'calibrated_loops':{'%s_%s_%s'%k:n for k,n in loops.items()}}
    (out/'environment.json').write_text(json.dumps(env,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    assert len(rows)==len(SIZES)*len(POSITIONS)*len(KINDS)*REPEATS
    assert all(len([r for r in rows if (r['size'],r['position'],r['container'])==k])==REPEATS for k in timers)
    print(f'EXPERIMENT_OK {len(rows)} raw rows, {len(summaries)} summary rows')
    for row in summaries:print(row)
    return summaries

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--out',default='data');args=parser.parse_args();run(args.out)
