import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.95.0";

const project=Deno.env.get("SUPABASE_URL")||"";
const keys=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
const pubKeys=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}");
const adminKey=keys.default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const pubKey=pubKeys.default||Deno.env.get("SUPABASE_ANON_KEY")||"";
const admin=createClient(project,adminKey,{auth:{persistSession:false,autoRefreshToken:false}});
const api=project+"/functions/v1/t07-pds";
const headers={"Content-Type":"application/json;charset=utf-8","Cache-Control":"no-store"};
const rand=(n)=>Array.from(crypto.getRandomValues(new Uint8Array(n)),x=>x.toString(16).padStart(2,"0")).join("");
async function sha256(text){
 const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
 return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,"0")).join("");
}
const json=(body,status)=>new Response(JSON.stringify(body),{status,headers});
async function invoke(action,payload={},token="",extraHeaders={},url=api){
 const h={"Content-Type":"application/json"};
 if(token)h.Authorization="Bearer "+token;
 const r=await fetch(url,{method:"POST",headers:{...h,...extraHeaders},body:JSON.stringify({action,...payload})});
 let body={};try{body=await r.json()}catch{}
 return {status:r.status,body};
}
Deno.serve(async(request)=>{
 if(request.method!=="POST")return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);
 const challenge=request.headers.get("x-t07-proof")||"";
 if(!/^[a-f0-9]{64}$/.test(challenge))return json({ok:false,error:"NOT_FOUND"},404);
 const h=await sha256(challenge);
 const claim=await admin.rpc("t07_probe_claim",{p_hash:h});
 if(claim.error||claim.data!==true)return json({ok:false,error:"NOT_FOUND"},404);
 const checks=[],created=[];
 let cleanupOk=true, fatal=null;
 const record=(name,passed,response,expected)=>{
  checks.push({name,pass:Boolean(passed),status:response?.status??null,expected:expected??null,
    response_error:response?.body?.error||null});
 };
 const assert=(name,r,status,error=null)=>{
  record(name,r.status===status&&(!error||r.body.error===error),r,status);
 };
 try{
  const key=rand(9);
  const password=rand(25),nextPassword=rand(25);
  const mailA="t07-probe-"+key+"a@example.com",mailB="t07-probe-"+key+"b@example.com";
  for(const email of [mailA,mailB]){
   const result=await admin.auth.admin.createUser({email,password,email_confirm:true});
   if(result.error||!result.data.user)throw new Error("TEST_USER_CREATE_FAILED");
   created.push(result.data.user.id);
  }
  const [a,b]=created;
  const hashes=await admin.rpc("t07_probe_password_hashes",{a,b});
  record("two_test_users_same_password_distinct_bcrypt",
    !hashes.error && hashes.data?.both_present===true&&hashes.data?.different===true&&hashes.data?.stored_as_bcrypt===true&&hashes.data?.plaintext_absent===true,
    {status:hashes.error?500:200},200);
  const logA=await invoke("login",{email:mailA,password});
  const logB=await invoke("login",{email:mailB,password});
  assert("account_A_login",logA,200);
  assert("account_B_login",logB,200);
  if(!logA.body.token||!logB.body.token)throw Error("LOGIN_TOKENS_MISSING");
  const ta=logA.body.token,tb=logB.body.token;
  record("session_has_future_expiry",Boolean(logA.body.expires_at&&Date.parse(logA.body.expires_at)>Date.now()),logA,200);

  const paR=await invoke("create_plan",{title:"T07 ephemeral A",start_date:"2026-10-08",end_date:"2026-10-08",priority:"low",success_criteria:"Security proof only; delete test accounts"},ta);
  const pbR=await invoke("create_plan",{title:"T07 ephemeral B",start_date:"2026-10-08",end_date:"2026-10-08",priority:"low",success_criteria:"Security proof only; delete test accounts"},tb);
  assert("A_create_own_plan",paR,200);assert("B_create_own_plan",pbR,200);
  const pa=paR.body.plan?.id,pb=pbR.body.plan?.id;
  if(!pa||!pb)throw Error("TEST_PLANS_MISSING");
  const taskA=await invoke("create_task",{plan_id:pa,title:"private A",due_date:"2026-10-08",priority:"low",expected_minutes:0},ta);
  const taskB=await invoke("create_task",{plan_id:pb,title:"private B",due_date:"2026-10-08",priority:"low",expected_minutes:0},tb);
  assert("A_create_own_task",taskA,200);assert("B_create_own_task",taskB,200);
  const ia=taskA.body.task?.id,ib=taskB.body.task?.id;
  if(!ia||!ib)throw Error("TEST_TASKS_MISSING");

  const stateA=await invoke("state",{},ta),stateB=await invoke("state",{},tb);
  record("A_list_excludes_B",stateA.status===200 && stateA.body.tasks?.length===1 &&stateA.body.tasks?.[0]?.id===ia && !JSON.stringify(stateA.body).includes(pb),stateA,200);
  record("B_list_excludes_A",stateB.status===200 && stateB.body.tasks?.length===1 &&stateB.body.tasks?.[0]?.id===ib && !JSON.stringify(stateB.body).includes(pa),stateB,200);
  assert("A_get_own_plan",await invoke("get_plan",{id:pa},ta),200);
  assert("B_get_own_task",await invoke("get_task",{id:ib},tb),200);
  assert("A_to_B_read_plan_404",await invoke("get_plan",{id:pb},ta),404,"NOT_FOUND");
  assert("B_to_A_read_plan_404",await invoke("get_plan",{id:pa},tb),404,"NOT_FOUND");
  assert("A_to_B_read_task_404",await invoke("get_task",{id:ib},ta),404,"NOT_FOUND");
  assert("B_to_A_read_task_404",await invoke("get_task",{id:ia},tb),404,"NOT_FOUND");
  const crossPatch={title:"forbidden",due_date:"2026-10-08",priority:"low",expected_minutes:0};
  assert("A_to_B_update_task_404",await invoke("update_task",{id:ib,...crossPatch},ta),404,"NOT_FOUND");
  assert("B_to_A_update_task_404",await invoke("update_task",{id:ia,...crossPatch},tb),404,"NOT_FOUND");
  assert("A_to_B_delete_task_404",await invoke("delete_task",{id:ib},ta),404,"NOT_FOUND");
  assert("B_to_A_delete_task_404",await invoke("delete_task",{id:ia},tb),404,"NOT_FOUND");
  assert("B_to_A_create_task_404",await invoke("create_task",{plan_id:pa,title:"cross",due_date:"2026-10-08"},tb),404,"NOT_FOUND");
  const spoof=await invoke("state",{owner_id:a,plan_id:pa},tb,{"x-owner-id":a},api+"?owner_id="+a);
  record("B_spoof_owner_in_url_header_body",spoof.status===200 && !JSON.stringify(spoof.body).includes(pa)&& spoof.body.plans?.length===1&&spoof.body.plans?.[0]?.id===pb,spoof,200);
  const afterwardA=await invoke("state",{},ta),afterwardB=await invoke("state",{},tb);
  record("A_data_unchanged_after_denials",afterwardA.status===200 && afterwardA.body.tasks?.length===1&&afterwardA.body.tasks?.[0]?.title==="private A",afterwardA,200);
  record("B_data_unchanged_after_denials",afterwardB.status===200 && afterwardB.body.tasks?.length===1&&afterwardB.body.tasks?.[0]?.title==="private B",afterwardB,200);
  const noauth=await invoke("state");
  assert("unauthenticated_state_401",noauth,401,"UNAUTHORIZED");
  const absent=await invoke("login",{email:"t07-no-such-"+key+"@example.com",password});
  const wrong=await invoke("login",{email:mailA,password:rand(25)});
  record("unknown_email_and_wrong_password_same_error",absent.status===401&&wrong.status===401&&absent.body.error==="INVALID_CREDENTIALS"&&wrong.body.error==="INVALID_CREDENTIALS",{status:absent.status,body:absent.body},401);
  const logout=await invoke("logout",{},ta);
  assert("logout_A_200",logout,200);
  const reuse=await invoke("state",{},ta);
  assert("same_POST_state_after_logout_A_401",reuse,401,"UNAUTHORIZED");
  const pw=await invoke("change_password",{current_password:password,new_password:nextPassword},tb);
  assert("B_password_change",pw,200);
  const oldAfterPw=await invoke("state",{},tb);
  assert("B_old_session_after_password_change_401",oldAfterPw,401,"UNAUTHORIZED");
  const fresh=await invoke("login",{email:mailB,password:nextPassword});
  assert("B_login_new_password",fresh,200);
  if(fresh.body.token){
   const del=await invoke("delete_account",{current_password:nextPassword},fresh.body.token);
   assert("B_delete_account_with_cascade",del,200);
   if(del.status===200)created.splice(created.indexOf(b),1);
   const oldAfterDel=await invoke("state",{},fresh.body.token);
   assert("B_old_session_after_account_delete_401",oldAfterDel,401,"UNAUTHORIZED");
  }
 }catch(error){
  fatal=error instanceof Error?error.message:"UNEXPECTED_TEST_ERROR";
 }finally{
  for(const uid of created){
   try{
    const r=await admin.auth.admin.deleteUser(uid);
    if(r.error)cleanupOk=false;
   }catch{cleanupOk=false}
  }
 }
 return json({ok:!fatal&&checks.every(c=>c.pass)&&cleanupOk,
  test_count:checks.length,pass_count:checks.filter(c=>c.pass).length,
  fatal,cleanup_ok:cleanupOk,checks,
  audit:"Ephemeral Auth accounts and linked data deleted; only sanitized HTTP statuses are returned. No token/password/email/user id is in this response."},200);
});
