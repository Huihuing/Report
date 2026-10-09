'use strict';
/* BR-A: only reviewed/approved excerpt IDs are published by tools/update.py. */
(async function loadPublishedFacts(){
  try {
    const response = await fetch('./data/published.json', {cache:'no-store'});
    if (!response.ok) throw new Error('public summary unavailable');
    const data = await response.json();
    const stats=data.metrics||{};
    for (const [id,field] of Object.entries({'metric-days':'ritual_days','metric-evening':'evening_records','metric-done':'full_actions','metric-partial':'partial_actions','metric-missed':'missed_actions'})) {
      const element=document.getElementById(id);
      if(element && Number.isInteger(stats[field])) element.firstChild.textContent=String(stats[field]);
    }
    const source=document.getElementById('metric-source');
    if(source) source.textContent='출처: '+(stats.record_source||'리추얼 기록')+' · '+(stats.count_rule||'');
    const attendance=document.getElementById('attendance-state');
    if(attendance) attendance.textContent=stats.attendance_days===null||stats.attendance_days===undefined
      ?'13주 출석 원본: 미제공 (출석률 표시 안 함)':'출석 일수: '+stats.attendance_days+'일 · '+stats.attendance_source;
    const target=document.getElementById('approved-stories');
    if(target && Array.isArray(data.approved_stories) && data.approved_stories.length){
      target.replaceChildren();
      for (const story of data.approved_stories){
        const panel=document.createElement('article'); panel.className='approved-story';
        const heading=document.createElement('strong');heading.textContent=story.date+' · '+story.skill_label;
        const detail=document.createElement('p');detail.textContent=story.sentence;
        panel.append(heading,detail);target.append(panel);
      }
    }
  } catch (err) {
    // Static fallback numbers have the same source; failure does not reveal sensitive raw data.
    console.warn('Published metrics could not be updated; static fallback shown.');
  }
})();
