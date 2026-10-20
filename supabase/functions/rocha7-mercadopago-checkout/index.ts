import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SECRET_KEYS = Deno.env.get("SUPABASE_SECRET_KEYS");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  (SECRET_KEYS ? (() => { try { return JSON.parse(SECRET_KEYS).default ?? ""; } catch { return ""; } })() : "");
const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") ?? "";
const PROD_ORIGIN = "https://rocha7.vercel.app";
const SITE_ORIGIN = (Deno.env.get("ROCHA7_SITE_URL") ?? PROD_ORIGIN).replace(/\/+$/, "");
const ORIGINS = new Set([PROD_ORIGIN, SITE_ORIGIN, "http://localhost:5500", "http://127.0.0.1:5500", "http://localhost:3000", "http://127.0.0.1:3000"]);

function reply(req: Request, status: number, payload: Record<string, unknown>) {
  const origin = req.headers.get("origin") || "";
  const headers: Record<string, string> = { "Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store", "Vary":"Origin", "X-Content-Type-Options":"nosniff", "Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods":"POST, OPTIONS" };
  if (ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return new Response(JSON.stringify(payload), { status, headers });
}
const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const admin = () => createClient(SUPABASE_URL, SERVICE_KEY, { auth:{autoRefreshToken:false,persistSession:false} });

async function mp(path: string, method: "GET"|"POST", body?: unknown, idempotencyKey?: string) {
  const headers: Record<string,string> = { Authorization:"Bearer "+MP_TOKEN };
  if (body) headers["Content-Type"]="application/json";
  if (idempotencyKey) headers["X-Idempotency-Key"]=idempotencyKey;
  const r=await fetch("https://api.mercadopago.com"+path,{method,headers,body:body?JSON.stringify(body):undefined});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) { console.error("Mercado Pago API failure",r.status); throw new Error("O Mercado Pago não conseguiu preparar este pagamento. Confira as credenciais de teste."); }
  return data as Record<string,unknown>;
}
Deno.serve(async(req:Request)=>{
  const origin=req.headers.get("origin")||"";
  if(req.method==="OPTIONS") return ORIGINS.has(origin) ? new Response("ok",{headers:{"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"}}) : reply(req,403,{error:"Origem não autorizada."});
  if(req.method!=="POST") return reply(req,405,{error:"Método não permitido."});
  if(origin&&!ORIGINS.has(origin)) return reply(req,403,{error:"Origem não autorizada."});
  if(!SUPABASE_URL||!SERVICE_KEY) return reply(req,500,{error:"Serviço de pagamento indisponível."});
  let body:Record<string,unknown>;
  try { const raw=await req.text(); if(new TextEncoder().encode(raw).length>16384) return reply(req,413,{error:"Solicitação muito grande."}); body=JSON.parse(raw); if(!body||typeof body!=="object"||Array.isArray(body)) throw new Error(); }
  catch { return reply(req,400,{error:"Corpo da solicitação inválido."}); }
  const db=admin();

  if(body.action==="status") {
    if(!uuid(body.pedidoId)||!uuid(body.idempotencyKey)) return reply(req,400,{error:"Identificador inválido."});
    const {data,error}=await db.from("pedidos").select("id,pagamento_status").eq("id",body.pedidoId).eq("idempotencia_id",body.idempotencyKey).eq("provedor_pagamento","mercadopago").maybeSingle();
    if(error) return reply(req,503,{error:"Não foi possível consultar o pagamento agora."});
    if(!data) return reply(req,404,{error:"Pedido de pagamento não encontrado."});
    return reply(req,200,{pedidoId:data.id,status:data.pagamento_status});
  }
  if(body.action!=="create") return reply(req,400,{error:"Ação inválida."});
  if(!MP_TOKEN) return reply(req,503,{error:"Pagamentos de teste ainda não estão configurados."});
  if(!uuid(body.pedidoId)||!uuid(body.idempotencyKey)) return reply(req,400,{error:"Pedido ou chave inválidos."});
  const pedidoId=String(body.pedidoId), key=String(body.idempotencyKey);
  const {data:order,error:orderError}=await db.from("pedidos").select("id,idempotencia_id,email_cliente,valor_total,status,pagamento_status,mercadopago_preference_id").eq("id",pedidoId).eq("idempotencia_id",key).maybeSingle();
  if(orderError) return reply(req,503,{error:"Não foi possível validar o pedido."});
  if(!order) return reply(req,404,{error:"Pedido não encontrado para esta tentativa."});
  if(order.status==="cancelado") return reply(req,409,{error:"Este pedido foi cancelado."});
  if(order.pagamento_status==="pago") return reply(req,409,{error:"Este pedido já possui pagamento confirmado."});
  if(order.mercadopago_preference_id) {
    try {
      const previous=await mp("/checkout/preferences/"+encodeURIComponent(String(order.mercadopago_preference_id)),"GET");
      if(typeof previous.init_point==="string") return reply(req,200,{url:previous.init_point,preferenceId:previous.id,reused:true});
    } catch { /* cria uma nova preferência abaixo */ }
  }
  const {data:items,error:itemsError}=await db.from("itens_pedido").select("nome_produto,tamanho,cor,quantidade,preco_unitario").eq("pedido_id",pedidoId).limit(100);
  if(itemsError||!items||!items.length||items.length>100) return reply(req,503,{error:"Não foi possível montar os itens do pedido."});
  let cents=0;
  const normalized=[];
  for(const i of items) {
    const unit=Math.round(Number(i.preco_unitario)*100), qty=Number(i.quantidade);
    if(!Number.isSafeInteger(unit)||unit<1||!Number.isInteger(qty)||qty<1||qty>500) return reply(req,409,{error:"Os valores do pedido não podem ser cobrados com segurança."});
    cents+=unit*qty;
    normalized.push({title:[i.nome_produto,i.tamanho,i.cor].filter(Boolean).join(" - ").slice(0,240),quantity:qty,unit_price:unit/100,currency_id:"BRL"});
  }
  if(cents!==Math.round(Number(order.valor_total)*100)||cents<1) return reply(req,409,{error:"O total dos itens não corresponde ao pedido."});
  const site=ORIGINS.has(origin)?origin:SITE_ORIGIN;
  const url=site+"/pagamento.html?pedido_id="+encodeURIComponent(pedidoId)+"&estado=";
  let pref:Record<string,unknown>;
  try {
    pref=await mp("/checkout/preferences","POST",{
      items:normalized,
      payer:{email:String(order.email_cliente)},
      external_reference:pedidoId,
      metadata:{order_id:pedidoId,idempotency_key:key},
      back_urls:{success:url+"sucesso",pending:url+"pendente",failure:url+"falhou"},
      auto_return:"approved",
      notification_url:SUPABASE_URL+"/functions/v1/rocha7-mercadopago-webhook"
    },key);
  } catch(e) { return reply(req,502,{error:e instanceof Error?e.message:"Não foi possível iniciar o pagamento."}); }
  const preferenceId=typeof pref.id==="string"?pref.id:"";
  const checkoutUrl=typeof pref.init_point==="string"?pref.init_point:"";
  if(!preferenceId||!/^https:\/\/(www\.)?mercadopago\.com(\.br)?\//.test(checkoutUrl)) return reply(req,502,{error:"O Mercado Pago não retornou um checkout válido."});
  const {data:saved,error:saveError}=await db.from("pedidos").update({mercadopago_preference_id:preferenceId,provedor_pagamento:"mercadopago",pagamento_status:"pendente",mercadopago_payment_id:null,mercadopago_payment_method:null,pagamento_confirmado_em:null}).eq("id",pedidoId).eq("idempotencia_id",key).neq("pagamento_status","pago").select("id").maybeSingle();
  if(saveError||!saved) return reply(req,503,{error:"A preferência foi criada, mas não pôde ser associada ao pedido. Tente novamente; não crie outro pedido."});
  return reply(req,200,{url:checkoutUrl,preferenceId,reused:false});
});
