import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.95.0";
const URL=Deno.env.get("SUPABASE_URL")||"";
const keys=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
const admin=createClient(URL,keys.default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",{auth:{autoRefreshToken:false,persistSession:false}});
const id=()=>Array.from(crypto.getRandomValues(new Uint8Array(12)),x=>x.toString(16).padStart(2,"0")).join("");
const hash=async v=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v))),x=>x.toString(16).padStart(2,"0")).join("");
const output=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
const endpoint=URL+"/functions/v1/t07-pds";
async function req(action,payload={},token=""){
 const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},body:JSON.stringify({action,...payload})});
 let body={};try{body=await r.json()}catch{}
 return {status:r.status,error:body.error||null,data:body};
}
Deno.serve(async incoming=>{
 if(incoming.method!=="POST")return output({error:"METHOD_NOT_ALLOWED"},405);
 const challenge=incoming.headers.get("x-t07-proof")||"";
 if(!/^[0-9a-f]{64}$/.test(challenge))return output({error:"NOT_FOUND"},404);
 const permitted=await admin.rpc("t07_probe_claim",{p_hash:await hash(challenge)});
 if(permitted.error||permitted.data!==true)return output({error:"NOT_FOUND"},404);
 let uid=null;let fatal=null,clean=true;const checks=[];
 function check(name,pass,code,expected){
   checks.push({name,pass:!!pass,status:code??null,expected:expected??null});
 }
 try{
  const userEmail="t07-delete-proof-"+id()+"@example.com";
  const password=id()+id(),password2=id()+id();
  const made=await admin.auth.admin.createUser({email:userEmail,password,email_confirm:true});
  if(made.error||!made.data.user)throw Error("TEMP_AUTH_CREATE_FAILED");
  uid=made.data.user.id;
  const login=await req("login",{email:userEmail,password});
  check("ephemeral_login_200",login.status===200&&typeof login.data.token==="string",login.status,200);
  if(!login.data.token)throw Error("NO_SESSION");
  const token=login.data.token;
  const plan=await req("create_plan",{title:"T07 deletion proof only",start_date:"2026-10-08",end_date:"2026-10-08",priority:"low",success_criteria:"DELETE ACCOUNT TEST"},token);
  check("create_before_delete_200",plan.status===200,plan.status,200);
  if(!plan.data.plan?.id)throw Error("NO_PLAN");
  const task=await req("create_task",{plan_id:plan.data.plan.id,title:"proof task",due_date:"2026-10-08",priority:"low"},token);
  check("create_task_before_delete_200",task.status===200,task.status,200);
  const result=await req("delete_account",{current_password:password},token);
  check("delete_account_API_200",result.status===200,result.status,200);
  if(result.status===200)uid=null;
  const after=await req("state",{},token);
  check("reused_session_after_delete_401",after.status===401&&after.error==="UNAUTHORIZED",after.status,401);
  const records=await admin.from("t07_plans").select("id").eq("title","T07 deletion proof only");
  check("test_account_records_cascade_deleted",!records.error&&(records.data||[]).length===0,records.error?500:200,200);
 }catch(error){fatal=error instanceof Error?error.message:"UNKNOWN_PROOF_ERROR"}
 finally{if(uid){const deleted=await admin.auth.admin.deleteUser(uid);if(deleted.error)clean=false;}}
 return output({ok:!fatal&&checks.every(x=>x.pass)&&clean,checks,cleanup_ok:clean,fatal,
  note:"Only sanitized response codes, no credentials/IDs."});
});
