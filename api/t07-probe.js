export default async function handler(req,res){
 const base="https://sckjbblzivbcoofabhqd.supabase.co/functions/v1/";
 const targets=[
  {name:"unauthenticated_t07_state",url:base+"t07-pds",action:"state"},
  {name:"legacy_t06_access",url:base+"t06-pds",action:"state"}
 ];
 const checks=[];

 for(const target of targets){
  try{
   const r=await fetch(target.url,{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({action:target.action})
   });
   const payload=await r.json();
   checks.push({name:target.name,status:r.status,error:payload.error||null,body_contains_user_data:Object.hasOwn(payload,"plans")||Object.hasOwn(payload,"tasks")});
  }catch{
   checks.push({name:target.name,status:502,error:"PROBE_UPSTREAM_FAILED",body_contains_user_data:false});
  }
 }
 res.setHeader("Cache-Control","no-store");
 const pass=checks[0].status===401&&checks[1].status===410&&checks.every(x=>!x.body_contains_user_data);
 return res.status(pass?200:502).json({ok:pass,checks});
}
