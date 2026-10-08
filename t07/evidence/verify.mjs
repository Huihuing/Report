import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

const source=new URL("./source-commits.json",import.meta.url);
const data=JSON.parse(readFileSync(source,"utf8"));
const fail=(msg)=>{throw new Error("INVALID_RETROSPECTIVE_EVIDENCE: "+msg)};
const dateKST=iso=>{
 const ms=Date.parse(iso);
 if(!Number.isFinite(ms))fail("invalid timestamp "+iso);
 return new Date(ms+9*3600_000).toISOString().slice(0,10);
};
const days=data.dates;
const allowed=new Set(data.included_repository_list);
if(!Array.isArray(days)||days.length!==5||new Set(days).size!==5)fail("exactly five distinct KST days required");
if(!days.every((d,i)=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&(i===0||days[i-1]<d)))fail("days must be ascending");
if(!Array.isArray(data.commits)||!data.commits.length)fail("no source commits");
const seen=new Set();
const byDayRepo=new Map();
for(const c of data.commits){
 if(!allowed.has(c.repo))fail("repository not in frozen public cohort: "+c.repo);
 if(!/^[a-f0-9]{40}$/.test(c.sha))fail("non-40-character SHA");
 const id=c.repo+"@"+c.sha;
 if(seen.has(id))fail("duplicate commit "+id);
 seen.add(id);
 const day=dateKST(c.utc);
 if(!days.includes(day))fail("commit outside the five chosen dates: "+id);
 const key=day+"|"+c.repo;
 byDayRepo.set(key,(byDayRepo.get(key)||0)+1);
}
for(const row of data.counts_by_repo_day){
 const actual=byDayRepo.get(row.day+"|"+row.repo)||0;
 if(row.commits!==actual)fail("frozen count mismatch "+row.day+" "+row.repo);
}
const totals=days.map(day=>({
 day,
 commits:data.commits.filter(x=>dateKST(x.utc)===day).length
}));
if(totals.some(row=>row.commits===0))fail("each chosen day needs public commit evidence");
const sum=totals.reduce((s,row)=>s+row.commits,0);
const average=values=>Math.round(10*values.reduce((a,b)=>a+b,0)/values.length)/10;
const before=totals.slice(0,2).map(x=>x.commits);
const after=totals.slice(2).map(x=>x.commits);
const result={
 result:"PASS",
 evidence_type:"public Git repository retrospective",
 distinct_days:5,
 consecutive_days:false,
 authenticated_T07_app_used_for_5_days:false,
 selected_public_repositories:data.included_repository_list,
 daily_counts:totals,
 source_commit_count:sum,
 mean_commits_per_selected_day:average(totals.map(x=>x.commits)),
 first_two_day_mean:average(before),
 last_three_day_mean:average(after),
 descriptive_difference:Math.round(10*(average(after)-average(before)))/10,
 warning:"A Git commit is not an hour worked. Retrospective grouping is not contemporaneous T07 diary use; no historical plan-rule intervention is claimed."
};
console.log(JSON.stringify(result,null,2));
