#!/usr/bin/env python3
"""BR-A updater: reproducibility and approval-gate tests with fresh folders."""
import copy
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
FILES=['published.json','candidates.json','review.md']

def digest(f): return hashlib.sha256(Path(f).read_bytes()).hexdigest()
def run(root,source,approval,folder):
    p=subprocess.run([sys.executable,str(ROOT/'tools/update.py'),
         '--ritual',str(source),'--assignments',str(ROOT/'inputs/assignments.json'),
         '--attendance',str(ROOT/'inputs/attendance.json'),'--approved',str(approval),'--out',str(folder)],
          cwd=root,encoding='utf-8',capture_output=True)
    if p.returncode: raise AssertionError(p.stderr or p.stdout)
    return p.stdout.strip()

def main():
    with tempfile.TemporaryDirectory(prefix='bra-check-') as base:
        base=Path(base)
        a,b=base/'fresh-A',base/'fresh-B';a.mkdir();b.mkdir()
        source_a=a/'ritual.json'; source_b=b/'ritual.json'; approved_a=a/'approved.json';approved_b=b/'approved.json'
        shutil.copy2(ROOT/'inputs/ritual_safe.json',source_a)
        shutil.copy2(ROOT/'inputs/ritual_safe.json',source_b)
        shutil.copy2(ROOT/'inputs/approved.json',approved_a)
        shutil.copy2(ROOT/'inputs/approved.json',approved_b)
        print('FRESH_A',run(a,source_a,approved_a,a/'output'))
        print('FRESH_B',run(b,source_b,approved_b,b/'output'))
        for f in FILES:
            assert digest(a/'output'/f)==digest(b/'output'/f), f+' not deterministic'
        actual=json.loads((a/'output/published.json').read_text(encoding='utf-8'))
        assert actual['metrics']['ritual_days']==39
        assert actual['metrics']['evening_records']==36
        assert actual['metrics']['full_actions']==11
        assert actual['metrics']['partial_actions']==21
        assert actual['metrics']['missed_actions']==4
        assert actual['metrics']['evening_missing']==3
        assert actual['metrics']['attendance_days'] is None
        assert actual['approved_stories']==[]
        candidates=json.loads((a/'output/candidates.json').read_text(encoding='utf-8'))['candidates']
        assert len(candidates)>=3
        # A new dated entry increases the count, but is not published without approval.
        changed=json.loads(source_a.read_text(encoding='utf-8'))
        changed['days'].append({'date':'2026-10-12','open':['강점이 드러난 일화: 수업 전에 미리 준비하고 공부했다.'],
                                'close':['강점 행동: 실천했다']})
        changed_path=a/'new.json';changed_path.write_text(json.dumps(changed,ensure_ascii=False),encoding='utf-8')
        run(a,changed_path,approved_a,a/'changed')
        newpub=json.loads((a/'changed/published.json').read_text(encoding='utf-8'))
        assert newpub['metrics']['ritual_days']==40
        assert newpub['metrics']['full_actions']==12
        assert len(newpub['approved_stories'])==0
        # Human-review approval list acts as a strict publication gate.
        newcandidates=json.loads((a/'changed/candidates.json').read_text(encoding='utf-8'))['candidates']
        chosen=next(c['id'] for c in newcandidates if c['date']=='2026-10-12')
        approved_a.write_text(json.dumps({'approved_candidate_ids':[chosen]}),encoding='utf-8')
        run(a,changed_path,approved_a,a/'approved')
        result=json.loads((a/'approved/published.json').read_text(encoding='utf-8'))
        assert [v['id'] for v in result['approved_stories']]==[chosen]
        # Original public input does not contain third-party individual-name fields.
        for row in json.loads(source_b.read_text(encoding='utf-8'))['days']:
            assert all(x.startswith('강점이 드러난 일화:') for x in row['open'])
            assert all(x.startswith(('강점 행동:','강점을 위해 노력하고 생각한 것:')) for x in row['close'])
        print('TEST_PASS fresh_folder_A_B_identical=True checks=metrics,privacy,approval,new_record')
        print('SHA256_PUBLISHED',digest(a/'output/published.json'))
if __name__=='__main__':main()
