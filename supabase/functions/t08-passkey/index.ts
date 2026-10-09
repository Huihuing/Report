import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import {
 generateRegistrationOptions,verifyRegistrationResponse,
 generateAuthenticationOptions,verifyAuthenticationResponse
} from "npm:@simplewebauthn/server@13.2.2";

const ORIGIN="https://report-huihuing.vercel.app";
const RP="report-huihuing.vercel.app";
const URL=Deno.env.get("SUPABASE_URL")||"";
const SECRET=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
const ADMIN_KEY=SECRET.default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const db=createClient(URL,ADMIN_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const HEAD={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization,content-type","Access-Control-Allow-Methods":"POST,GET,OPTIONS","Access-Control-Max-Age":"3600","Vary":"Origin"};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:HEAD});
const safe=(s,max=60)=>typeof s==="string"?s.trim().slice(0,max):"";
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,"0")).join("");
const sha=async s=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s))),v=>v.toString(16).padStart(2,"0")).join("");
const base64url=bytes=>btoa(Array.from(bytes,v=>String.fromCharCode(v)).join("")).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const rawBytes=s=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(s.length/4)*4,"=")),c=>c.charCodeAt(0));
const uuidBytes=s=>Uint8Array.from(s.replace(/-/g,"").match(/.{2}/g).map(h=>parseInt(h,16)));
function must(value,code="SERVER_DATA_ERROR"){if(!value)throw Error(code);return value;}
function result(r){if(r.error)throw Error("SERVER_DATA_ERROR");return r.data;}
function requireId(value){const s=safe(value,64);if(!/^[a-f0-9-]{36}$/i.test(s))throw Error("INVALID_CHALLENGE");return s;}
async function currentUser(req){
 const bearer=req.headers.get("authorization")||"";
 if(!/^Bearer [a-f0-9]{64}$/i.test(bearer))throw Error("UNAUTHORIZED");
 const digest=await sha(bearer.slice(7));
 const now=new Date().toISOString();
 const data=result(await db.from("t08_sessions").select("owner_id,expires_at").eq("token_hash",digest).gt("expires_at",now).maybeSingle());
 if(!data)throw Error("UNAUTHORIZED");
 return {owner:data.owner_id,hash:digest};
}
async function sessionFor(owner){
 const value=token();const expires_at=new Date(Date.now()+60*60*1000).toISOString();
 result(await db.from("t08_sessions").insert({token_hash:await sha(value),owner_id:owner,expires_at}));
 return {session:value,expires_at};
}
async function privateState(owner){
 const notes=result(await db.from("t08_private_notes").select("id,title,body,position").eq("owner_id",owner).order("position"));
 const keys=result(await db.from("t08_credentials").select("id,label,created_at,last_used_at,device_type,backed_up,public_key_b64").eq("owner_id",owner).order("created_at"));
 return {notes,passkeys:keys.map(k=>({...k,public_key_prefix:k.public_key_b64.slice(0,32),public_key_b64:undefined})),public_key_explanation:"서버 DB의 public_key_b64는 COSE 인코딩된 공개키입니다. 개인키는 브라우저/기기에서 절대 서버로 전송하지 않습니다."};
}
async function action(req,b){
 const act=safe(b.action,36);
 if(act==="health")return {ok:true,service:"t08-passkey",kind:"WebAuthn, passwordless",rp_id:RP};
 if(act==="register_begin"){
   const authorization=req.headers.get("authorization");
   const user=authorization?await currentUser(req):null;
   const kind=user?"register_add":"register_new";
   const owner=user?.owner||crypto.randomUUID();
   let excluded=[];
   if(user){
    excluded=result(await db.from("t08_credentials").select("id,transports").eq("owner_id",owner))
      .map(x=>({id:x.id,transports:x.transports||[]}));
   }
   const options=await generateRegistrationOptions({
    rpName:"T08 · Private Workspace",rpID:RP,
    userName:"t08-"+owner.slice(0,8),userDisplayName:"Private Space "+owner.slice(0,8),
    userID:uuidBytes(owner),attestationType:"none",
    authenticatorSelection:{residentKey:"required",requireResidentKey:true,userVerification:"required"},
    supportedAlgorithmIDs:[-7,-257],excludeCredentials:excluded,
    timeout:60000
   });
   const requestId=crypto.randomUUID();
   result(await db.from("t08_challenges").insert({
    id:requestId,kind,challenge:options.challenge,
    proposed_account:user?null:owner,owner_id:user?owner:null
   }));
   return {ok:true,request_id:requestId,kind,options};
 }
 if(act==="register_cancel"){
   const id=requireId(b.request_id);
   const user=req.headers.get("authorization")?await currentUser(req):null;
   const query=db.from("t08_challenges").update({consumed_at:new Date().toISOString()})
       .eq("id",id).is("consumed_at",null).in("kind",user?["register_add"]:["register_new"]);
   result(await (user?query.eq("owner_id",user.owner):query));
   return {ok:true,cancelled:true};
 }
 if(act==="register_finish"){
   const user=req.headers.get("authorization")?await currentUser(req):null;
   const kind=user?"register_add":"register_new";
   const consumed=result(await db.rpc("t08_take_challenge",{p_id:requireId(b.request_id),p_kind:kind}));
   if(!consumed)throw Error("CHALLENGE_EXPIRED_OR_USED");
   const owner=user?user.owner:consumed.proposed_account;
   if(user&&consumed.owner_id!==user.owner)throw Error("FORBIDDEN");
   let verified;
   try {
    verified=await verifyRegistrationResponse({
      response:b.credential,expectedChallenge:consumed.challenge,
      expectedOrigin:ORIGIN,expectedRPID:RP,requireUserVerification:true
    });
   }catch{throw Error("INVALID_ATTESTATION");}
   if(!verified.verified||!verified.registrationInfo)throw Error("INVALID_ATTESTATION");
   const info=verified.registrationInfo;
   const key=info.credential;
   if(!key?.id||!key?.publicKey)throw Error("INVALID_ATTESTATION");
   const label=safe(b.label)||"새 패스키";
   const data={
    id:key.id,owner_id:owner,public_key_b64:base64url(key.publicKey),
    counter:key.counter||0,transports:key.transports||[],
    device_type:info.credentialDeviceType||"unknown",
    backed_up:!!info.credentialBackedUp,label
   };
   if(user) {
     result(await db.from("t08_credentials").insert(data));
     return {ok:true,registered:true,public_key_b64:data.public_key_b64,
       public_key_explanation:"COSE 공개키(Base64URL). 개인키와 비밀번호는 서버로 전달하지 않음."};
   }
   result(await db.rpc("t08_initialize_account",{
    p_owner:owner,p_credential_id:data.id,p_public_key:data.public_key_b64,
    p_counter:data.counter,p_transports:data.transports,p_device_type:data.device_type,
    p_backed_up:data.backed_up,p_label:data.label
   }));
   return {ok:true,registered:true,public_key_b64:data.public_key_b64,...await sessionFor(owner)};
 }
 if(act==="login_begin"){
   const options=await generateAuthenticationOptions({
    rpID:RP,userVerification:"required",timeout:60000
   });
   const requestId=crypto.randomUUID();
   result(await db.from("t08_challenges").insert({id:requestId,kind:"login",challenge:options.challenge}));
   return {ok:true,request_id:requestId,options};
 }
 if(act==="login_finish"){
   const ch=result(await db.rpc("t08_take_challenge",{p_id:requireId(b.request_id),p_kind:"login"}));
   if(!ch)throw Error("CHALLENGE_EXPIRED_OR_USED");
   const credentialId=safe(b.credential?.id,1400);
   if(!credentialId)throw Error("INVALID_ASSERTION");
   const row=result(await db.from("t08_credentials")
     .select("id,owner_id,public_key_b64,counter,transports").eq("id",credentialId).maybeSingle());
   if(!row)throw Error("INVALID_ASSERTION");
   let checked;
   try {
     checked=await verifyAuthenticationResponse({
      response:b.credential,expectedChallenge:ch.challenge,expectedOrigin:ORIGIN,
      expectedRPID:RP,requireUserVerification:true,
      credential:{id:row.id,publicKey:rawBytes(row.public_key_b64),
       counter:Number(row.counter),transports:row.transports||[]}
     });
   }catch{throw Error("INVALID_ASSERTION");}
   if(!checked.verified)throw Error("INVALID_ASSERTION");
   const newCounter=checked.authenticationInfo.newCounter;
   // A non-zero authenticator counter must advance. DB conditional update limits concurrency replay.
   let q=db.from("t08_credentials").update({counter:newCounter,last_used_at:new Date().toISOString()})
     .eq("id",row.id).eq("owner_id",row.owner_id);
   if(Number(row.counter)>0||newCounter>0)q=q.eq("counter",row.counter);
   const changed=result(await q.select("id").maybeSingle());
   if(!changed)throw Error("INVALID_ASSERTION");
   return {ok:true,...await sessionFor(row.owner_id)};
 }
 if(act==="private"||act==="state"){
   const user=await currentUser(req);
   return {ok:true,...await privateState(user.owner)};
 }
 if(act==="logout"){
   const user=await currentUser(req);
   result(await db.from("t08_sessions").delete().eq("token_hash",user.hash));
   return {ok:true,logged_out:true};
 }
 if(act==="remove_passkey"){
   const user=await currentUser(req);
   const credId=safe(b.id,1400);
   const row=result(await db.from("t08_credentials").select("id").eq("id",credId).eq("owner_id",user.owner).maybeSingle());
   if(!row)throw Error("NOT_FOUND");
   const deleted=result(await db.rpc("t08_remove_credential",{p_owner:user.owner,p_id:credId}));
   if(!deleted)throw Error("LAST_PASSKEY_PROTECTED");
   return {ok:true,deleted:true};
 }
 if(act==="rename_passkey"){
   const user=await currentUser(req);
   const label=safe(b.label);
   if(!label)throw Error("INVALID_LABEL");
   const id=safe(b.id,1400);
   const row=result(await db.from("t08_credentials").update({label}).eq("id",id).eq("owner_id",user.owner).select("id").maybeSingle());
   if(!row)throw Error("NOT_FOUND");
   return {ok:true,renamed:true};
 }
 throw Error("UNKNOWN_ACTION");
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:HEAD});
 const origin=req.headers.get("origin");
 if(origin&&origin!==ORIGIN)return reply({ok:false,error:"ORIGIN_NOT_ALLOWED"},403);
 if(req.method==="GET"){
   const path=new URL(req.url).searchParams.get("resource");
   return path==="private"?reply({ok:false,error:"UNAUTHORIZED"},401):
    reply({ok:true,service:"t08-passkey",private_content_embedded:false},200);
 }
 if(req.method!=="POST")return reply({ok:false,error:"METHOD_NOT_ALLOWED"},405);
 try{
   const b=await req.json();
   if(!b||typeof b!=="object"||Array.isArray(b))throw Error("INVALID_BODY");
   return reply(await action(req,b));
 }catch(error){
   const msg=error instanceof Error?error.message:"REQUEST_FAILED";
   const status=msg==="UNAUTHORIZED"?401:msg==="FORBIDDEN"||msg==="ORIGIN_NOT_ALLOWED"?403:
     msg==="NOT_FOUND"?404:msg==="CHALLENGE_EXPIRED_OR_USED"?409:
     msg==="LAST_PASSKEY_PROTECTED"?409:
     msg==="SERVER_DATA_ERROR"?500:400;
   const visible=/^(UNAUTHORIZED|FORBIDDEN|ORIGIN_NOT_ALLOWED|NOT_FOUND|CHALLENGE_EXPIRED_OR_USED|LAST_PASSKEY_PROTECTED|INVALID_ASSERTION|INVALID_ATTESTATION|INVALID_CHALLENGE|INVALID_LABEL|INVALID_BODY|UNKNOWN_ACTION|SERVER_DATA_ERROR)$/.test(msg)?msg:"REQUEST_FAILED";
   return reply({ok:false,error:visible},status);
 }
});