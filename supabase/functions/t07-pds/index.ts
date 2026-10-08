import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.95.0";
const URL_BASE=Deno.env.get("SUPABASE_URL")||"";
const SECRET_KEYS=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
const PUBLIC_KEYS=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}");
const PRIV=SECRET_KEYS.default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const PUB=PUBLIC_KEYS.default||Deno.env.get("SUPABASE_ANON_KEY")||"";
const admin=createClient(URL_BASE,PRIV,{auth:{autoRefreshToken:false,persistSession:false}});
const cors={"Access-Control-Allow-Origin":"https://report-huihuing.vercel.app","Access-Control-Allow-Methods":"POST,OPTIONS","Access-Control-Allow-Headers":"authorization,content-type","Access-Control-Max-Age":"3600","Cache-Control":"no-store","Content-Type":"application/json; charset=utf-8","X-Content-Type-Options":"nosniff"};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
const clean=(v,max=1000)=>typeof v==="string"?v.trim().slice(0,max):"";
const minutes=(v)=>{let x=Number(v);if(!Number.isInteger(x)||x<0||x>100000)throw Error("INVALID_MINUTES");return x;};
const priority=v=>["high","medium","low"].includes(v)?v:"medium";
const date=v=>{const s=String(v||"");if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||Number.isNaN(Date.parse(s+"T00:00:00Z")))throw Error("INVALID_DATE");return s;};
const uuid=v=>{const s=String(v||"");if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s))throw Error("NOT_FOUND");return s;};
const tags=v=>Array.isArray(v)?v.map(x=>clean(x,30)).filter(Boolean).slice(0,10):[];
const iso=v=>{const d=new Date(v);if(!Number.isFinite(d.getTime()))throw Error("INVALID_TIME");return d.toISOString();};
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const untrustedOwnerError=e=>{if(e)throw Error("REQUEST_FAILED");};
const digest=async token=>{const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");};
const publicAuth=()=>createClient(URL_BASE,PUB,{auth:{autoRefreshToken:false,persistSession:false}});
const freshToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,"0")).join("");

async function checkSession(req){
 const header=req.headers.get("authorization")||"";
 if(!/^Bearer [a-f0-9]{64}$/i.test(header))throw Error("UNAUTHORIZED");
 const token=header.slice(7);
 const hash=await digest(token);
 const {data,error}=await admin.from("t07_sessions").select("user_id,expires_at").eq("token_hash",hash).maybeSingle();
 if(error||!data||new Date(data.expires_at).getTime()<=Date.now())throw Error("UNAUTHORIZED");
 return {uid:data.user_id,hash,token};
}
async function createSession(userId){
 const token=freshToken();
 const expires=new Date(Date.now()+60*60*1000).toISOString();
 const {error}=await admin.from("t07_sessions").insert({token_hash:await digest(token),user_id:userId,expires_at:expires});
 if(error)throw Error("SESSION_CREATE_FAILED");
 return {token,expires_at:expires};
}
async function getState(uid,requested){
 const p=await admin.from("t07_plans").select("*").eq("owner_id",uid).order("created_at");
 untrustedOwnerError(p.error);
 const plans=p.data||[];
 const planId=plans.find(x=>x.id===requested)?.id||plans[0]?.id||null;
 const tasks=planId?await admin.from("t07_tasks").select("*").eq("owner_id",uid).eq("plan_id",planId).is("deleted_at",null).order("due_date"): {data:[],error:null};
 untrustedOwnerError(tasks.error);
 const taskRows=tasks.data||[];
 const ids=taskRows.map(t=>t.id);
 const getNested=async(table,idCol)=>ids.length?await admin.from(table).select("*").eq("owner_id",uid).in(idCol,ids):{data:[],error:null};
 const [e,c,rev,refl,days,rules]=await Promise.all([
  getNested("t07_execution_logs","task_id"),
  getNested("t07_completion_events","task_id"),
  planId?admin.from("t07_plan_revisions").select("*").eq("owner_id",uid).eq("plan_id",planId).order("revision_no"):{data:[],error:null},
  planId?admin.from("t07_reflections").select("*").eq("owner_id",uid).eq("plan_id",planId):{data:[],error:null},
  admin.from("t07_day_entries").select("*").eq("owner_id",uid).order("day_date"),
  admin.from("t07_rule_settings").select("*").eq("owner_id",uid).maybeSingle()
 ]);
 for(const q of [e,c,rev,refl,days,rules])untrustedOwnerError(q.error);
 const executions=e.data||[], t=today();
 const summary={
  plan_count:taskRows.length,
  completed_count:taskRows.filter(x=>x.completed).length,
  delayed_count:taskRows.filter(x=>!x.completed&&x.due_date<t).length,
  blocked_count:taskRows.filter(x=>executions.some(z=>z.task_id===x.id&&clean(z.blocker_reason))).length,
  expected_minutes:taskRows.reduce((sum,x)=>sum+(x.expected_minutes||0),0),
  actual_minutes:executions.reduce((sum,x)=>sum+(x.actual_minutes||0),0)
 };
 summary.difference_minutes=summary.actual_minutes-summary.expected_minutes;
 const dayRows=days.data||[], values=dayRows.map(x=>x.metric_minutes).filter(x=>x!==null);
 const daySummary={count:dayRows.length,total_minutes:values.reduce((a,b)=>a+b,0),average_minutes:values.length?Math.round(values.reduce((a,b)=>a+b,0)*10/values.length)/10:0,
 before_minutes:dayRows.filter(x=>x.rule_version===1&&x.metric_minutes!==null).map(x=>x.metric_minutes),
 after_minutes:dayRows.filter(x=>x.rule_version===2&&x.metric_minutes!==null).map(x=>x.metric_minutes)};
 const average=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)*10/a.length)/10:0;
 daySummary.before_average=average(daySummary.before_minutes);
 daySummary.after_average=average(daySummary.after_minutes);
 return {ok:true,plans,active_plan_id:planId,tasks:taskRows,executions,completions:c.data||[],revisions:rev.data||[],reflections:refl.data||[],today:t,summary,
  days:dayRows,day_summary:daySummary,rule_settings:rules.data||null,
  sort_rule:"마감일 오름차순 → 우선순위 high/medium/low → 생성시각 오름차순",timezone:"Asia/Seoul"};
}
async function authAction(action,b){
 const email=clean(b.email,250).toLowerCase();
 const password=typeof b.password==="string"?b.password:"";
 if(!email.includes("@")||!email.includes(".")||password.length<10||password.length>128)throw Error("INVALID_CREDENTIAL_FORMAT");
 if(action==="signup"){
  const {error}=await publicAuth().auth.signUp({email,password});
  if(error&&/rate limit/i.test(error.message))throw Error("TRY_AGAIN_LATER");
  return {ok:true,message:"가입 요청을 접수했습니다. 이메일 확인이 필요한 경우 메일을 확인한 뒤 로그인하세요."};
 }
 const {data,error}=await publicAuth().auth.signInWithPassword({email,password});
 if(error||!data?.user)throw Error("INVALID_CREDENTIALS");
 const session=await createSession(data.user.id);
 return {ok:true,...session};
}
async function verifyOwnTask(uid,id){
 const q=await admin.from("t07_tasks").select("id,completed").eq("owner_id",uid).eq("id",uuid(id)).is("deleted_at",null).maybeSingle();
 if(q.error||!q.data)throw Error("NOT_FOUND");
 return q.data;
}
async function verifyOwnPlan(uid,id){
 const q=await admin.from("t07_plans").select("id").eq("owner_id",uid).eq("id",uuid(id)).maybeSingle();
 if(q.error||!q.data)throw Error("NOT_FOUND");
 return q.data;
}
async function ownedMutation(table,uid,id,patch,soft=false){
 const q=await admin.from(table).update(patch).eq("owner_id",uid).eq("id",uuid(id))
  .select("*").maybeSingle();
 if(q.error||!q.data)throw Error("NOT_FOUND");
 return {ok:true,row:q.data};
}
async function handle(action,b,req){
 if(action==="signup"||action==="login")return authAction(action,b);
 const session=await checkSession(req);
 const uid=session.uid;
 if(action==="me")return {ok:true,user_id:uid,expires_at:undefined};
 if(action==="logout"){
  const q=await admin.from("t07_sessions").delete().eq("token_hash",session.hash).eq("user_id",uid);
  untrustedOwnerError(q.error);return {ok:true};
 }
 if(action==="state")return getState(uid,b.plan_id);
 if(action==="claim"){
  const code=clean(b.code,100);
  if(!/^[a-f0-9]{48}$/.test(code))throw Error("INVALID_OR_USED_MIGRATION_CODE");
  const q=await admin.rpc("t07_claim_legacy",{p_code:code,p_owner:uid});
  if(q.error)throw Error("INVALID_OR_USED_MIGRATION_CODE");
  return {ok:true,counts:q.data};
 }
 if(action==="create_plan"){
  const record={owner_id:uid,title:clean(b.title,160),start_date:date(b.start_date),end_date:date(b.end_date),
   priority:priority(b.priority),success_criteria:clean(b.success_criteria,1000),expected_minutes:minutes(b.expected_minutes||0)};
  if(!record.title||!record.success_criteria||record.end_date<record.start_date)throw Error("INVALID_PLAN");
  const q=await admin.from("t07_plans").insert(record).select("*").single();untrustedOwnerError(q.error);
  return {ok:true,plan:q.data};
 }
 if(action==="update_plan"){
  await verifyOwnPlan(uid,b.id);
  const q=await admin.rpc("t07_update_plan",{p_owner:uid,p_id:uuid(b.id),p_title:clean(b.title,160),p_start:date(b.start_date),p_end:date(b.end_date),p_priority:priority(b.priority),p_criteria:clean(b.success_criteria,1000),p_minutes:minutes(b.expected_minutes||0)});
  untrustedOwnerError(q.error);return {ok:true,plan:q.data};
 }
 if(action==="get_plan"){const id=uuid(b.id);const q=await admin.from("t07_plans").select("*").eq("owner_id",uid).eq("id",id).maybeSingle();if(q.error||!q.data)throw Error("NOT_FOUND");return {ok:true,plan:q.data};}
 if(action==="create_task"){
  await verifyOwnPlan(uid,b.plan_id);
  const record={owner_id:uid,plan_id:uuid(b.plan_id),title:clean(b.title,240),due_date:date(b.due_date),priority:priority(b.priority),tags:tags(b.tags),expected_minutes:minutes(b.expected_minutes||0)};
  if(!record.title)throw Error("INVALID_TASK");
  const q=await admin.from("t07_tasks").insert(record).select("*").single();untrustedOwnerError(q.error);return {ok:true,task:q.data};
 }
 if(action==="get_task"){const task=await verifyOwnTask(uid,b.id);return {ok:true,task};}
 if(action==="update_task"){
  await verifyOwnTask(uid,b.id);
  return ownedMutation("t07_tasks",uid,b.id,{title:clean(b.title,240),due_date:date(b.due_date),priority:priority(b.priority),tags:tags(b.tags),expected_minutes:minutes(b.expected_minutes||0),updated_at:new Date().toISOString()});
 }
 if(action==="delete_task"){
  await verifyOwnTask(uid,b.id);
  return ownedMutation("t07_tasks",uid,b.id,{deleted_at:new Date().toISOString(),updated_at:new Date().toISOString()});
 }
 if(action==="set_completed"){
  await verifyOwnTask(uid,b.id);
  const q=await admin.rpc("t07_set_completed",{p_owner:uid,p_id:uuid(b.id),p_completed:Boolean(b.completed)});
  untrustedOwnerError(q.error);return {ok:true,result:q.data};
 }
 if(action==="add_execution"){
  await verifyOwnTask(uid,b.task_id);
  const started=iso(b.started_at),ended=iso(b.ended_at);if(ended<started)throw Error("INVALID_TIME");
  const row={owner_id:uid,task_id:uuid(b.task_id),started_at:started,ended_at:ended,actual_minutes:minutes(b.actual_minutes),blocker_reason:clean(b.blocker_reason,1000)};
  const q=await admin.from("t07_execution_logs").insert(row).select("*").single();untrustedOwnerError(q.error);return {ok:true,execution:q.data};
 }
 if(action==="carry_reflection"){
  await verifyOwnPlan(uid,b.plan_id);
  const note=clean(b.improvement_note,1000);if(!note)throw Error("INVALID_NOTE");
  const next=await admin.from("t07_plans").insert({
   owner_id:uid,title:clean(b.next_title,160),start_date:date(b.next_start_date),end_date:date(b.next_end_date),
   priority:"high",success_criteria:clean(b.next_success_criteria,1000),expected_minutes:minutes(b.next_expected_minutes||0),next_from_reflection:note
  }).select("*").single();untrustedOwnerError(next.error);
  const link=await admin.from("t07_reflections").insert({owner_id:uid,plan_id:uuid(b.plan_id),improvement_note:note,next_plan_id:next.data.id}).select("*").single();
  untrustedOwnerError(link.error);return {ok:true,next_plan:next.data,reflection:link.data};
 }
 if(action==="setup_study"){
  const existing=await admin.from("t07_rule_settings").select("owner_id").eq("owner_id",uid).maybeSingle();untrustedOwnerError(existing.error);
  if(existing.data)throw Error("QUESTION_ALREADY_FIXED");
  const record={owner_id:uid,question:clean(b.question,500),metric_name:clean(b.metric_name,120),unit:clean(b.unit,20),computation_rule:clean(b.computation_rule,500),
   missing_rule:"측정되지 않은 날은 null로 표시하고 평균에서 제외",
   duplicate_rule:"날짜별 한 건만 저장하며 중복 입력은 기존 기록 수정",
   outlier_rule:"이상치도 근거 설명과 함께 그대로 보관",
   rounding_rule:"분 단위 정수, 평균은 소수 첫째 자리 반올림",
   week_starts_on:"Monday",initial_rule:clean(b.initial_rule,500)};
  if(!record.question||!record.metric_name||!record.unit||!record.computation_rule||!record.initial_rule)throw Error("REQUIRED_STUDY_FIELDS");
  const q=await admin.from("t07_rule_settings").insert(record);untrustedOwnerError(q.error);return {ok:true};
 }
 if(action==="save_day"){
  const day=date(b.day_date), t=today();if(day!==t)throw Error("ONLY_CURRENT_KST_DAY");
  const rules=await admin.from("t07_rule_settings").select("*").eq("owner_id",uid).maybeSingle();if(rules.error||!rules.data)throw Error("STUDY_NOT_CONFIGURED");
  const entries=await admin.from("t07_day_entries").select("day_date").eq("owner_id",uid).order("day_date");untrustedOwnerError(entries.error);
  const list=entries.data||[];
  const exists=list.some(x=>x.day_date===day);
  if(!exists&&(list.length>=5||list.length>=2&&!rules.data.changed_at))throw Error("CHANGE_RULE_BEFORE_DAY3");
  if(!exists&&list.some(x=>x.day_date>day))throw Error("INVALID_DAY_ORDER");
  const metric=b.metric_minutes===null||b.metric_minutes===""?null:minutes(b.metric_minutes);
  const v=rules.data.changed_at?2:1;
  const q=await admin.from("t07_day_entries").upsert({owner_id:uid,day_date:day,metric_minutes:metric,note:clean(b.note,1000),rule_version:exists?(await admin.from("t07_day_entries").select("rule_version").eq("owner_id",uid).eq("day_date",day).single()).data.rule_version:v},
    {onConflict:"owner_id,day_date"}).select("*").single();
  untrustedOwnerError(q.error);return {ok:true,day:q.data};
 }
 if(action==="change_rule"){
  const rules=await admin.from("t07_rule_settings").select("*").eq("owner_id",uid).single();untrustedOwnerError(rules.error);
  if(rules.data.changed_at)throw Error("RULE_ALREADY_CHANGED");
  const entries=await admin.from("t07_day_entries").select("*").eq("owner_id",uid).order("day_date");untrustedOwnerError(entries.error);
  if(entries.data.length!==2)throw Error("RULE_CHANGE_REQUIRES_EXACTLY_TWO_DAYS");
  if(entries.data[0].day_date===entries.data[1].day_date)throw Error("INVALID_DAY_ORDER");
  const newRule=clean(b.changed_rule,500),reason=clean(b.reason,500);if(!newRule||!reason)throw Error("REQUIRED_RULE_REASON");
  const q=await admin.from("t07_rule_settings").update({changed_rule:newRule,changed_reason:reason,changed_at:new Date().toISOString(),day1_date:entries.data[0].day_date,day2_date:entries.data[1].day_date}).eq("owner_id",uid).is("changed_at",null);
  untrustedOwnerError(q.error);return {ok:true};
 }
 if(action==="export"){
  const tables=["t07_plans","t07_plan_revisions","t07_tasks","t07_completion_events","t07_execution_logs","t07_reflections","t07_day_entries","t07_rule_settings"];
  const out={};for(const table of tables){const q=await admin.from(table).select("*").eq("owner_id",uid);untrustedOwnerError(q.error);out[table]=q.data||[];}
  return {ok:true,exported_at:new Date().toISOString(),timezone:"Asia/Seoul",records:out};
 }
 if(action==="change_password"||action==="delete_account"){
  const who=await admin.auth.admin.getUserById(uid);
  if(who.error||!who.data.user?.email)throw Error("USER_NOT_FOUND");
  const login=await publicAuth().auth.signInWithPassword({email:who.data.user.email,password:String(b.current_password||"")});
  if(login.error||login.data.user?.id!==uid)throw Error("INVALID_CREDENTIALS");
  if(action==="change_password"){
   if(typeof b.new_password!=="string"||b.new_password.length<10)throw Error("INVALID_PASSWORD");
   const update=await admin.auth.admin.updateUserById(uid,{password:b.new_password});if(update.error)throw Error("PASSWORD_CHANGE_FAILED");
   const revoked=await admin.from("t07_sessions").delete().eq("user_id",uid);untrustedOwnerError(revoked.error);
   return {ok:true,all_sessions_revoked:true};
  }
  const revoked=await admin.from("t07_sessions").delete().eq("user_id",uid);untrustedOwnerError(revoked.error);
  const deleted=await admin.auth.admin.deleteUser(uid);
  if(deleted.error)throw Error("ACCOUNT_DELETION_FAILED");
  return {ok:true,account_deleted:true};
 }
 throw Error("UNKNOWN_ACTION");
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return response({ok:false,error:"METHOD_NOT_ALLOWED"},405);
 const origin=req.headers.get("origin");
 if(origin&&origin!=="https://report-huihuing.vercel.app")return response({ok:false,error:"ORIGIN_NOT_ALLOWED"},403);
 try{
  const b=await req.json();
  if(!b||typeof b!=="object"||Array.isArray(b))throw Error("INVALID_BODY");
  const result=await handle(clean(b.action,80),b,req);
  return response(result);
 }catch(e){
  const msg=e instanceof Error?e.message:"REQUEST_FAILED";
  const status=msg==="UNAUTHORIZED"?401:msg==="NOT_FOUND"?404:msg==="INVALID_CREDENTIALS"?401:
     msg==="UNKNOWN_ACTION"?400:msg==="INVALID_OR_USED_MIGRATION_CODE"?403:400;
  const visible=/^(UNAUTHORIZED|NOT_FOUND|INVALID_CREDENTIALS|UNKNOWN_ACTION|INVALID_OR_USED_MIGRATION_CODE|[A-Z_]{5,50})$/.test(msg)?msg:"REQUEST_FAILED";
  return response({ok:false,error:visible},status);
 }
});
