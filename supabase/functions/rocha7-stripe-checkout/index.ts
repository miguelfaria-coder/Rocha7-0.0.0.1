import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SITE_URL = (Deno.env.get("ROCHA7_SITE_URL") ?? "https://rocha7.vercel.app").replace(/\/$/, "");
const corsHeaders = {
  "Access-Control-Allow-Origin": SITE_URL,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Vary": "Origin",
  "X-Content-Type-Options": "nosniff",
};
const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") return origin === SITE_URL
    ? new Response("ok", { headers: corsHeaders })
    : json(403, { error: "Origem não autorizada." });
  if (origin && origin !== SITE_URL) return json(403, { error: "Origem não autorizada." });
  if (req.method !== "POST") return json(405, { error: "Método não permitido." });
  if (!SUPABASE_URL || !SERVICE_KEY || !STRIPE_SECRET_KEY) {
    return json(503, { error: "Pagamento indisponível: configure as variáveis de ambiente do Stripe no Supabase." });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: "Solicitação inválida." }); }
  const pedidoId = typeof body.pedidoId === "string" ? body.pedidoId.trim() : "";
  const forma = typeof body.formaPagamento === "string" ? body.formaPagamento : "";
  if (!pedidoId || pedidoId.length > 100 || !["cartao", "pix", "boleto"].includes(forma)) {
    return json(400, { error: "Pedido ou forma de pagamento inválidos." });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: pedido, error: pedidoError } = await admin
    .from("pedidos")
    .select("id, valor_total, nome, email, forma_pagamento")
    .eq("id", pedidoId)
    .maybeSingle();
  if (pedidoError || !pedido) return json(404, { error: "Pedido não encontrado." });

  const amount = Math.round(Number(pedido.valor_total) * 100);
  if (!Number.isSafeInteger(amount) || amount < 100 || amount > 100000000) {
    return json(400, { error: "O valor do pedido não pode ser processado pelo checkout." });
  }

  // The amount and customer data are read from the trusted database, never from the browser.
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `${SITE_URL}/pagamento-retorno.html?session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${SITE_URL}/checkout.html?pagamento=cancelado`);
  params.set("client_reference_id", String(pedido.id));
  params.set("customer_email", String(pedido.email || ""));
  params.set("metadata[pedido_id]", String(pedido.id));
  params.set("payment_intent_data[metadata][pedido_id]", String(pedido.id));
  params.set("line_items[0][price_data][currency]", "brl");
  params.set("line_items[0][price_data][unit_amount]", String(amount));
  params.set("line_items[0][price_data][product_data][name]", `Pedido Rocha7 #${pedido.id}`);
  params.set("line_items[0][quantity]", "1");
  const stripeMethod = forma === "cartao" ? "card" : forma;
  params.set("payment_method_types[0]", stripeMethod);

  let stripeResponse: Response;
  try {
    stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `rocha7-checkout-${String(pedido.id).replace(/[^a-zA-Z0-9_-]/g, "")}-${forma}`,
      },
      body: params,
    });
  } catch {
    return json(502, { error: "Não foi possível conectar ao provedor de pagamentos. Tente novamente." });
  }

  const session = await stripeResponse.json().catch(() => ({}));
  if (!stripeResponse.ok || typeof session.url !== "string" || typeof session.id !== "string") {
    console.error("Stripe Checkout session error:", stripeResponse.status, session?.error?.code || "unknown");
    return json(502, { error: "O Stripe não conseguiu iniciar esse pagamento. Verifique os métodos habilitados na conta de teste." });
  }

  const { error: updateError } = await admin.from("pedidos").update({
    status_pagamento: "pendente",
    stripe_session_id: session.id,
    forma_pagamento: forma,
  }).eq("id", pedido.id);
  if (updateError) {
    console.error("Could not attach Stripe session to order:", updateError.message);
    // Do not redirect to a session that cannot be associated with the order.
    await fetch(`https://api.stripe.com/v1/checkout/sessions/${session.id}/expire`, {
      method: "POST", headers: { "Authorization": `Bearer ${STRIPE_SECRET_KEY}` },
    }).catch(() => undefined);
    return json(500, { error: "Não foi possível vincular o pagamento ao pedido." });
  }

  return json(200, { url: session.url, sessionId: session.id });
});
