import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const headers={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization,content-type",
  "Access-Control-Allow-Methods":"POST,OPTIONS",
  "Content-Type":"application/json; charset=utf-8",
  "Cache-Control":"no-store",
  "X-Content-Type-Options":"nosniff"
};

Deno.serve((request)=>{
 if(request.method==="OPTIONS")return new Response("ok",{headers});
 return new Response(JSON.stringify({
   ok:false,
   error:"T06_DATA_MIGRATED_TO_PRIVATE_T07",
   message:"T06 공개 데이터 API는 T07 계정 보호를 위해 중단되었습니다. /t07/에서 로그인한 뒤 기록을 이전하세요."
 }),{status:410,headers});
});
