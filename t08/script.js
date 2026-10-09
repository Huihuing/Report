"use strict";
/* T08 browser WebAuthn: no password inputs, no private fixture strings in static files. */
const ENDPOINT="https://sckjbblzivbcoofabhqd.supabase.co/functions/v1/t08-passkey";
let bearer=sessionStorage.getItem("t08_session")||"";
const $=s=>document.querySelector(s);
const text=(el,s)=>{el.textContent=s;};
const decode=encoded=>Uint8Array.from(atob(encoded.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(encoded.length/4)*4,"=")),c=>c.charCodeAt(0));
const encode=bytes=>btoa(Array.from(new Uint8Array(bytes),b=>String.fromCharCode(b)).join("")).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const friendly={
 UNAUTHORIZED:"로그인 세션이 만료되거나 폐기됐습니다. 다시 패스키로 로그인하세요.",
 NOT_FOUND:"내 공간에 없는 패스키입니다.",
 CHALLENGE_EXPIRED_OR_USED:"질문이 만료되었거나 이미 사용되었습니다. 새로 시작하세요.",
 INVALID_ASSERTION:"패스키 서명 확인에 실패했습니다. 올바른 패스키를 사용하세요.",
 INVALID_ATTESTATION:"등록 응답을 확인할 수 없습니다. 다른 패스키나 기기를 사용하세요.",
 LAST_PASSKEY_PROTECTED:"마지막 패스키는 삭제할 수 없습니다. 분실 대비용 두 번째 패스키를 먼저 등록하세요.",
 SERVER_DATA_ERROR:"서버 자료 처리 오류입니다. 잠시 뒤 다시 시도하세요.",
 FORBIDDEN:"이 계정에서 허용되지 않는 작업입니다.",
 INVALID_LABEL:"패스키 이름을 입력하세요."
};
const message=(value)=>text($("#authMessage"),value);
async function request(action,body={},tokenValue=bearer){
 const response=await fetch(ENDPOINT,{
  method:"POST",mode:"cors",cache:"no-store",
  headers:{"Content-Type":"application/json",...(tokenValue?{Authorization:"Bearer "+tokenValue}:{})},
  body:JSON.stringify({action,...body})
 });
 let data={};try{data=await response.json();}catch{}
 if(!response.ok||!data.ok)throw Object.assign(new Error(friendly[data.error]||data.error||"API_ERROR"),{code:data.error||"API_ERROR",status:response.status});
 return data;
}
function createOptions(raw){
 return {...raw,
  challenge:decode(raw.challenge),
  user:{...raw.user,id:decode(raw.user.id)},
  excludeCredentials:(raw.excludeCredentials||[]).map(c=>({...c,id:decode(c.id)}))
 };
}
function getOptions(raw){
 return {...raw,
  challenge:decode(raw.challenge),
  allowCredentials:(raw.allowCredentials||[]).map(c=>({...c,id:decode(c.id)}))
 };
}
function registrationJSON(credential){
 const r=credential.response;
 return {
  id:credential.id,rawId:encode(credential.rawId),type:credential.type,
  authenticatorAttachment:credential.authenticatorAttachment||undefined,
  response:{
   clientDataJSON:encode(r.clientDataJSON),
   attestationObject:encode(r.attestationObject),
   transports:typeof r.getTransports==="function"?r.getTransports():[]
  },
  clientExtensionResults:credential.getClientExtensionResults()||{}
 };
}
function authenticationJSON(credential){
 const r=credential.response;
 return {
  id:credential.id,rawId:encode(credential.rawId),type:credential.type,
  authenticatorAttachment:credential.authenticatorAttachment||undefined,
  response:{
   clientDataJSON:encode(r.clientDataJSON),
   authenticatorData:encode(r.authenticatorData),
   signature:encode(r.signature),
   userHandle:r.userHandle?encode(r.userHandle):undefined
  },
  clientExtensionResults:credential.getClientExtensionResults()||{}
 };
}
function locked(){
 $("#signedOut").hidden=false;$("#signedIn").hidden=true;
 $("#gateLabel").textContent="잠금 상태";
 $("#lockedPanel").hidden=false;$("#unlockedPanel").hidden=true;
 $("#vaultState").textContent="인증 필요";
 $("#passkeysPanel").hidden=true;
 $("#notes").replaceChildren();
 $("#passkeyList").replaceChildren();
}
function unlocked(data){
 $("#signedOut").hidden=true;$("#signedIn").hidden=false;
 $("#gateLabel").textContent="패스키 로그인됨";
 $("#lockedPanel").hidden=true;$("#unlockedPanel").hidden=false;
 $("#vaultState").textContent="본인 인증 완료";
 $("#passkeysPanel").hidden=false;
 $("#notes").replaceChildren();
 for(const note of data.notes){
  const article=document.createElement("article");article.className="note";
  const tag=document.createElement("span");tag.className="tag";tag.textContent="SYNTHETIC · "+note.position.toString().padStart(2,"0");
  const title=document.createElement("h3");title.textContent=note.title;
  const body=document.createElement("p");body.textContent=note.body;
  article.append(tag,title,body);$("#notes").append(article);
 }
 $("#passkeyList").replaceChildren();
 for(const key of data.passkeys){
  const item=document.createElement("article");item.className="passkey";
  const head=document.createElement("div");head.className="passkey-head";
  const name=document.createElement("strong");name.textContent=key.label;
  const date=document.createElement("span");date.textContent="등록 "+new Date(key.created_at).toLocaleString("ko-KR");
  head.append(name,date);
  const publicKey=document.createElement("code");publicKey.textContent="COSE 공개키 (일부): "+key.public_key_prefix+"…";
  const type=document.createElement("p");type.className="micro";type.textContent="저장 유형: "+key.device_type+(key.backed_up?" · 백업/동기화됨":"");
  const remove=document.createElement("button");remove.className="btn danger";remove.type="button";
  remove.textContent="이 패스키 삭제";
  remove.disabled=data.passkeys.length===1;
  remove.title=data.passkeys.length===1?"마지막 패스키 삭제를 방지합니다.":"";
  remove.addEventListener("click",async()=>{
   if(!confirm("선택한 패스키를 삭제할까요? 해당 패스키로는 로그인할 수 없습니다."))return;
   try{await request("remove_passkey",{id:key.id});message("선택한 패스키를 삭제했습니다. 남은 패스키로 로그인할 수 있습니다.");await refresh();}
   catch(e){message(e.message);}
  });
  item.append(head,publicKey,type,remove);$("#passkeyList").append(item);
 }
}
async function refresh(){
 const data=await request("private");
 unlocked(data);
}
async function saveSession(session){
 bearer=session;sessionStorage.setItem("t08_session",session);
 await refresh();
}
function cancelNotice(error){
 if(error?.name==="NotAllowedError"||error?.name==="AbortError")
  return "기기 패스키 창에서 취소했습니다. 새 패스키나 계정은 저장되지 않았습니다.";
 return error?.message||"패스키 처리를 완료하지 못했습니다.";
}
async function register(isAddition){
 const label=isAddition?($("#passkeyLabel").value.trim()||"추가 패스키"):"첫 번째 패스키";
 if(!window.PublicKeyCredential||!navigator.credentials?.create){message("이 브라우저는 WebAuthn 패스키 등록을 지원하지 않습니다.");return;}
 let requestId=null,completed=false;
 try{
  message("서버에서 등록용 일회용 질문을 생성했습니다. 기기의 패스키 창을 확인하세요.");
  const {options,request_id}=await request("register_begin",{},isAddition?bearer:"");
  requestId=request_id;
  const cred=await navigator.credentials.create({publicKey:createOptions(options)});
  if(!cred)throw Error("등록할 패스키를 선택하지 않았습니다.");
  const res=await request("register_finish",{request_id,credential:registrationJSON(cred),label},isAddition?bearer:"");
  completed=true;
  if(res.session)await saveSession(res.session);
  else await refresh();
  message("서버에서 서명/등록 데이터를 확인했습니다. 개인키를 서버에 전송하지 않았습니다.");
 }catch(error){message(cancelNotice(error));}
 finally{
  if(requestId&&!completed){try{await request("register_cancel",{request_id:requestId},isAddition?bearer:"");}catch{}}
 }
}
async function login(){
 if(!window.PublicKeyCredential||!navigator.credentials?.get){message("이 브라우저는 WebAuthn 로그인을 지원하지 않습니다.");return;}
 try{
  message("새 로그인 질문을 만들었습니다. 등록한 패스키로 서명하세요.");
  const {options,request_id}=await request("login_begin",{},"");
  const credential=await navigator.credentials.get({publicKey:getOptions(options)});
  if(!credential)throw Error("패스키를 선택하지 않았습니다.");
  const res=await request("login_finish",{request_id,credential:authenticationJSON(credential)},"");
  await saveSession(res.session);
  message("서버 공개키 서명 검증 성공 — 본인 자료만 조회했습니다.");
 }catch(error){message(cancelNotice(error));}
}
function guarded(btn,fn){
 btn.addEventListener("click",async()=>{
  btn.disabled=true;try{await fn();}finally{btn.disabled=false;}
 });
}
guarded($("#createBtn"),()=>register(false));
guarded($("#loginBtn"),login);
guarded($("#addPasskeyBtn"),()=>register(true));
guarded($("#logoutBtn"),async()=>{
 try{await request("logout");}catch{}
 bearer="";sessionStorage.removeItem("t08_session");
 locked();message("서버 세션을 폐기했습니다. 로그인했던 이전 세션으로 자료를 다시 읽을 수 없습니다.");
});
locked();
if(bearer)refresh().catch(()=>{
 bearer="";sessionStorage.removeItem("t08_session");locked();
 message("이전 세션이 유효하지 않아 잠금 상태로 전환했습니다.");
});
