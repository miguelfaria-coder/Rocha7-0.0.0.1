import { createClient } from "npm:@supabase/supabase-js@2.118.0";
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")??"";
const SECRET_KEYS=Deno.env.get("SUPABASE_SECRET_KEYS");
const SERVICE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??(SECRET_KEYS?(()=>{try{return JSON.parse(SECRET_KEYS).default??"";}catch{return "";}})():"");
const MP_TOKEN=Deno.env.get("MERCADOPAGO_ACCESS_TOKEN")??"";
const MP_WEBHOOK_SECRET=Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET")??"";

function equalHex(a:string,b:string){if(a.length!==b.length||!/^[a-f0-9]+$/i.test(b))return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;}
async function verify(id:string,requestId:string,header:string){
  if(!id||!requestId||!MP_WEBHOOK_SECRET)return false;
  let ts="",sig="";
  for(const part of header.split(",")){const [k,v]=part.split("=",2);if(k?.trim()==="ts")ts=v?.trim()||"";if(k?.trim()==="v1")sig=v?.trim()||"";}
  if(!/^\d+$/.test(ts)||!sig||Math.abs(Date.now()/1000-Number(ts))>86400)return false;
  const manifest=`id:${id.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(MP_WEBHOOK_SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const digest=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(manifest));
  const expected=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,"0")).join("");
  return equalHex(expected,sig);
}
Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return new Response("Method not allowed",{status:405});
  if(!SUPABASE_URL||!SERVICE_KEY||!MP_TOKEN||!MP_WEBHOOK_SECRET)return new Response("Webhook configuration unavailable",{status:500});
  const raw=await req.text();if(new TextEncoder().encode(raw).length>65536)return new Response("Payload too large",{status:413});
  let body:Record<string,unknown>;try{body=JSON.parse(raw);}catch{return new Response("Invalid JSON",{status:400});}
  const url=new URL(req.url);
  const data=body.data as Record<string,unknown>|undefined;
  const paymentId=String(url.searchParams.get("data.id")||url.searchParams.get("id")||data?.id||"");
  const type=String(url.searchParams.get("type")||body.type||body.action||"");
  if(!paymentId||!/^[0-9]+$/.test(paymentId))return new Response("Missing payment id",{status:400});
  if(type&&!type.toLowerCase().includes("payment"))return new Response(JSON.stringify({received:true,ignored:true}),{status:200,headers:{"Content-Type":"application/json"}});
  if(!await verify(paymentId,req.headers.get("x-request-id")||"",req.headers.get("x-signature")||""))return new Response("Invalid signature",{status:400});
  const response=await fetch("https://api.mercadopago.com/v1/payments/"+encodeURIComponent(paymentId),{headers:{Authorization:"Bearer "+MP_TOKEN}});
  if(!response.ok)return new Response("Payment lookup failed",{status:502});
  const payment=await response.json() as Record<string,unknown>;
  const orderId=typeof payment.external_reference==="string"?payment.external_reference:"";
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId))return new Response("Invalid order reference",{status:400});
  const db=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:order,error}=await db.from("pedidos").select("id,valor_total,forma_pagamento,pagamento_status,mercadopago_preference_id,provedor_pagamento").eq("id",orderId).eq("provedor_pagamento","mercadopago").eq("mercadopago_preference_id",String(payment.preference_id||"")).maybeSingle();
  if(error)return new Response("Database lookup failed",{status:500});
  if(!order)return new Response(JSON.stringify({received:true,ignored:true}),{status:200,headers:{"Content-Type":"application/json"}});
  const amount=Math.round(Number(order.valor_total)*100), paid=Math.round(Number(payment.transaction_amount)*100);
  if(payment.currency_id!=="BRL"||!Number.isSafeInteger(amount)||amount<1||paid!==amount)return new Response("Payment validation failed",{status:400});
  if(payment.status==="approved"&&order.pagamento_status!=="pago"){
    const method=String(payment.payment_method_id||"").slice(0,40);
    const form=method==="pix"?"pix":String(payment.payment_type_id||"").includes("card")?"cartao":order.forma_pagamento;
    const {error:updateError}=await db.from("pedidos").update({pagamento_status:"pago",forma_pagamento:form,mercadopago_payment_id:String(payment.id),mercadopago_payment_method:method,pagamento_confirmado_em:new Date().toISOString()}).eq("id",orderId).eq("mercadopago_preference_id",String(payment.preference_id)).neq("pagamento_status","pago");
    if(updateError)return new Response("Could not update payment",{status:500});
  } else if(["rejected","cancelled"].includes(String(payment.status))&&order.pagamento_status!=="pago"){
    const {error:updateError}=await db.from("pedidos").update({pagamento_status:"falhou",mercadopago_payment_id:String(payment.id),mercadopago_payment_method:String(payment.payment_method_id||"").slice(0,40)}).eq("id",orderId).eq("mercadopago_preference_id",String(payment.preference_id)).neq("pagamento_status","pago");
    if(updateError)return new Response("Could not update payment",{status:500});
  }
  return new Response(JSON.stringify({received:true}),{status:200,headers:{"Content-Type":"application/json"}});
});
