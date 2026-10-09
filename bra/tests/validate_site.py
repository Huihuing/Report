#!/usr/bin/env python3
"""Static website + docs assertions. No third party dependencies."""
import json,re
from pathlib import Path
base=Path(__file__).resolve().parents[1]
s=(base/'site/index.html').read_text(encoding='utf-8')
pub=json.loads((base/'site/data/published.json').read_text(encoding='utf-8'))
for marker in ['임희재','자기조절력','대인관계력','자기동기력','2025.05','2026.09.07','2026.10.08','../t10/','T13','./docs/resume.md','./docs/cover_letter.md','./docs/experience.md','github.com/Huihuing']:
 assert marker in s, marker
assert pub['metrics']['ritual_days']==39
assert pub['metrics']['evening_records']==36
assert pub['metrics']['full_actions']==11
assert pub['metrics']['partial_actions']==21
assert pub['metrics']['missed_actions']==4
assert pub['metrics']['evening_missing']==3
assert pub['metrics']['attendance_days'] is None
assert pub['approved_stories']==[]
for name in ('resume.md','cover_letter.md','experience.md'):
 assert (base/'site/docs'/name).exists()
all_public='\n'.join(p.read_text(encoding='utf-8') for p in (base/'site').rglob('*') if p.is_file())
assert '[[ALEPH_BODY_START]]' not in all_public
assert '[[ALEPH_BODY_END]]' not in all_public
assert '꺼지지 않은 커서' not in all_public
assert not re.search(r'\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{12,})\b',all_public)
print('SITE_PASS nav, story, skills, data_provenance, t10/t13, docs, no_novel, no_key')
