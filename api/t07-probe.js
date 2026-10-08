export default async function handler(req,res){
 const base="https://sckjbblzivbcoofabhqd.supabase.co/functions/v1/";
 const targets=[
  {name:"unauthenticated_t07_state",url:base+"t07-pds",action:"state"},
  {name:"legacy_t06_access",url:base+"t06-pds",action:"state"}
 ];
 const checks=[];
 const crypto=require("crypto");
 const randomEmail="t07-health-"+crypto.randomBytes(8).toString("hex")+"@example.invalid";
 const randomPassword=crypto.randomBytes(24).toString("hex");
 targets.push({name:"invalid_credentials_test",url:base+"t07-pds",action:"login",email:randomEmail,password:randomPassword});
 for(const target of targets){
  try{
   const r=await fetch(target.url,{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({action:target.action,email:target.email,password:target.password})
   });
   const payload=await r.json();
   checks.push({name:target.name,status:r.status,error:payload.error||null,body_contains_user_data:Object.hasOwn(payload,"plans")||Object.hasOwn(payload,"tasks")});
  }catch{
   checks.push({name:target.name,status:502,error:"PROBE_UPSTREAM_FAILED",body_contains_user_data:false});
  }
 }
 res.setHeader("Cache-Control","no-store");
 const pass=checks[0].status===401&&checks[1].status===410&&checks[2].status===401&&checks[2].error==="INVALID_CREDENTIALS"&&checks.every(x=>!x.body_contains_user_data);
 return res.status(pass?200:502).json({ok:pass,checks});
}
