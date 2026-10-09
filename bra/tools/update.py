#!/usr/bin/env python3
"""Deterministic BR-A ritual → metrics/candidates → approved-only publishing.
Python >=3.10, standard library only. Does not transmit data or call AI.
"""
import argparse
import json
import re
from pathlib import Path

SKILLS = {
    'self_regulation': ('자기조절력', ('참', '침착', '피곤', '피로', '쉬', '집중', '선택', '대응', '힘들', '불편', '못')),
    'relationships': ('대인관계력', ('도와', '알려', '설명', '친절', '길을', '질문', '경청', '함께', '배려')),
    'motivation': ('자기동기력', ('준비', '기록', '공부', '프로젝트', '과제', '예습', '노력', '목표', '마무리', '일찍')),
}
STATUS = ('실천했다', '일부 실천했다', '못 했다')
PRIVACY_PATTERNS = (r'\b(?:sk-[a-zA-Z0-9_-]{12,}|gh[pousr]_[a-zA-Z0-9]{12,})\b', r'\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b', r'01[016789]-?\d{3,4}-?\d{4}')

def read_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)

def dump(path, data):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(data, ensure_ascii=False, sort_keys=True, indent=2) + '\n', encoding='utf-8')

def field(lines, key):
    prefix = key + ':'
    for item in lines:
        if item.startswith(prefix):
            return item[len(prefix):].strip()
    return ''

def safe_excerpt(value):
    # Extract only explicitly selected first-person records, never peer-name fields.
    value = value.replace('(이름 가림)', '동료')
    value = re.sub(r'\s+', ' ', value).strip()
    for pattern in PRIVACY_PATTERNS:
        value = re.sub(pattern, '[비공개]', value)
    return value[:175]

def count_and_candidates(ritual):
    days = sorted(ritual['days'], key=lambda d:d['date'])
    if len(set(x['date'] for x in days)) != len(days):
        raise ValueError('날짜 중복 발견')
    counters={k:0 for k in STATUS}
    missing=0
    candidates=[]
    for day in days:
        date = day['date']
        opening = day.get('open') or []
        closing = day.get('close') or []
        status=field(closing,'강점 행동')
        if status in STATUS: counters[status]+=1
        else: missing+=1
        evidence = safe_excerpt(field(opening, '강점이 드러난 일화'))
        followup = safe_excerpt(field(closing, '강점을 위해 노력하고 생각한 것'))
        for slug,(label,keywords) in SKILLS.items():
            blob = evidence+' '+followup
            if any(kw in blob for kw in keywords) and evidence:
                candidates.append({'id':date+'-'+slug,'date':date,'skill':slug,'skill_label':label,
                                  'sentence':f'{date}에는 {evidence}',
                                  'evidence':evidence, 'followup':followup,
                                  'evidence_origin':'본인 아침 리추얼의 「강점이 드러난 일화」'})
    metrics={'ritual_days':len(days),'morning_records':sum(bool(x.get('open')) for x in days),
             'evening_records':sum(bool(x.get('close')) for x in days),
             'full_actions':counters['실천했다'],
             'partial_actions':counters['일부 실천했다'],
             'missed_actions':counters['못 했다'],
             'evening_missing':missing,
             'period_start':days[0]['date'] if days else None,
             'period_end':days[-1]['date'] if days else None,
             'record_source':'본인이 제공한 2026-10-08 기준 리추얼 JSON (일별 자기평가)',
             'count_rule':'날짜별 1회 집계. 미기록은 미실천에 합산하지 않음.'}
    assert sum(counters.values())+missing==len(days)
    return metrics,candidates

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--ritual', required=True)
    p.add_argument('--assignments', required=True)
    p.add_argument('--attendance', required=True)
    p.add_argument('--approved', required=True)
    p.add_argument('--out', required=True)
    args=p.parse_args()
    ritual=read_json(args.ritual)
    assignments=read_json(args.assignments)
    attendance=read_json(args.attendance)
    approved=read_json(args.approved)
    metrics, candidates=count_and_candidates(ritual)
    metrics['assignment_list_count']=len(assignments['items'])
    metrics['assignment_note']='제출·승인 건수가 아닌 사용자 산출물 목록 수'
    metrics['attendance_days']=attendance.get('attended_days')
    metrics['attendance_source']=attendance.get('source') or '출석 원본 미제공'
    selected=set(approved['approved_candidate_ids'])
    valid={x['id'] for x in candidates}
    if selected-valid: raise ValueError(f'근거가 없는 승인 ID: {sorted(selected-valid)}')
    published={'schema_version':1,'metrics':metrics,
               'approved_stories':[{key:item[key] for key in ('id','date','skill','skill_label','sentence','evidence_origin')}
                                    for item in candidates if item['id'] in selected],
               'approval_rule':'reviewer-selected candidate IDs only; unpublished candidates never appear on public page',
               'assignment_count':len(assignments['items'])}
    out=Path(args.out)
    dump(out/'published.json',published)
    dump(out/'candidates.json',{'candidates':candidates,'total':len(candidates),'note':'초안 후보. approved_candidate_ids에 넣기 전에는 사이트에 표시하지 않음.'})
    lines=['# BR-A 날짜별 이야기 후보 (공개 전 사람 검토 필수)','',
           '각 문장은 아침 리추얼 「강점이 드러난 일화」에서만 생성. 동료 발언, 개인정보, AI 추론은 추가하지 않습니다.','']
    for c in candidates:
        lines.extend([f"## {c['id']} · {c['skill_label']}",f"- 날짜: {c['date']}",f"- 후보: {c['sentence']}",f"- 기록 근거: {c['evidence']}",'- 선택: `approved_candidate_ids`에 ID를 넣어야 공개됨',''])
    (out/'review.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    print(f'UPDATE_OK ritual_days={metrics["ritual_days"]} evening={metrics["evening_records"]} candidates={len(candidates)} approved={len(published["approved_stories"])}')

if __name__=='__main__':main()
