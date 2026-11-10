import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SECRET_KEYS = Deno.env.get("SUPABASE_SECRET_KEYS");
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  (SECRET_KEYS ? (() => { try { return JSON.parse(SECRET_KEYS).default ?? ""; } catch { return ""; } })() : "");
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const PRODUCTION_ORIGIN = "https://rocha7.devs.surf";
const CONFIGURED_SITE_ORIGIN = (Deno.env.get("ROCHA7_SITE_URL") ?? PRODUCTION_ORIGIN).replace(/\/+$/, "");
const ALLOWED_ORIGINS = new Set([
  PRODUCTION_ORIGIN,
  CONFIGURED_SITE_ORIGIN,
  "https://rocha7-0-0-0-1.pages.dev",
  "https://rocha7.miguel-faria-497.workers.dev",
  "https://rocha7.vercel.app",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

function json(req: Request, status: number, body: Record<string, unknown>) {
  const origin = req.headers.get("origin") || "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return new Response(JSON.stringify(body), { status, headers });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function stripeRequest(path: string, method: "GET" | "POST", params?: URLSearchParams, idempotencyKey?: string) {
  const headers: Record<string, string> = {
    "Authorization": "Basic " + btoa(STRIPE_SECRET_KEY + ":"),
  };
  if (method === "POST") headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const url = "https://api.stripe.com/v1" + path;
  const response = await fetch(url, {
    method,
    headers,
    body: method === "POST" ? params?.toString() ?? "" : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const stripeError = (payload as { error?: { code?: string; type?: string } }).error;
    console.error("Stripe API request failed", response.status, stripeError?.type ?? "unknown", stripeError?.code ?? "unknown");
    throw new Error("O Stripe não conseguiu preparar este pagamento. Confira a configuração de teste e tente novamente.");
  }
  return payload as Record<string, unknown>;
}

function safeSiteOrigin(req: Request): string {
  const origin = req.headers.get("origin") || "";
  return ALLOWED_ORIGINS.has(origin) ? origin : CONFIGURED_SITE_ORIGIN;
}

const corsJson = (req: Request, status: number, body: Record<string, unknown>) => json(req, status, body);

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") {
    if (!ALLOWED_ORIGINS.has(origin)) return json(req, 403, { error: "Origem não autorizada." });
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Vary": "Origin",
      },
    });
  }
  if (req.method !== "POST") return corsJson(req, 405, { error: "Método não permitido." });
  if (origin && !ALLOWED_ORIGINS.has(origin)) return corsJson(req, 403, { error: "Origem não autorizada." });
  if (!SUPABASE_URL || !SERVICE_KEY) return corsJson(req, 500, { error: "Serviço de pagamento indisponível." });

  const contentLength = Number(req.headers.get("content-length") || "0");
  if (contentLength > 16384) return corsJson(req, 413, { error: "Solicitação muito grande." });

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > 16384) return corsJson(req, 413, { error: "Solicitação muito grande." });
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
    body = parsed;
  } catch {
    return corsJson(req, 400, { error: "Corpo da solicitação inválido." });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (body.action === "status") {
    const sessionId = body.sessionId;
    if (typeof sessionId !== "string" || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
      return corsJson(req, 400, { error: "Identificador de pagamento inválido." });
    }
    const { data, error } = await admin
      .from("pedidos")
      .select("id, pagamento_status, valor_total")
      .eq("stripe_checkout_session_id", sessionId)
      .maybeSingle();
    if (error) {
      console.error("Payment status lookup failed:", error.code);
      return corsJson(req, 503, { error: "Não foi possível consultar o pagamento agora." });
    }
    if (!data) return corsJson(req, 404, { error: "Pagamento não encontrado." });
    return corsJson(req, 200, { pedidoId: data.id, status: data.pagamento_status, valorTotal: data.valor_total });
  }

  if (body.action !== "create") return corsJson(req, 400, { error: "Ação inválida." });
  if (!STRIPE_SECRET_KEY.startsWith("sk_test_")) {
    console.error("Stripe checkout blocked: STRIPE_SECRET_KEY is missing or not a test key.");
    return corsJson(req, 503, { error: "Pagamentos em teste ainda não estão configurados." });
  }

  const pedidoId = body.pedidoId;
  const idempotencyKey = body.idempotencyKey;
  if (!isUuid(pedidoId) || !isUuid(idempotencyKey)) {
    return corsJson(req, 400, { error: "Pedido ou chave de tentativa inválidos." });
  }

  const { data: pedido, error: orderError } = await admin
    .from("pedidos")
    .select("id, idempotencia_id, email_cliente, valor_total, status, pagamento_status, stripe_checkout_session_id, stripe_checkout_attempt")
    .eq("id", pedidoId)
    .eq("idempotencia_id", idempotencyKey)
    .maybeSingle();

  if (orderError) {
    console.error("Order lookup for Stripe failed:", orderError.code);
    return corsJson(req, 503, { error: "Não foi possível validar o pedido agora." });
  }
  if (!pedido) return corsJson(req, 404, { error: "Pedido não encontrado para esta tentativa de checkout." });
  if (pedido.status === "cancelado") return corsJson(req, 409, { error: "Este pedido foi cancelado." });
  if (pedido.pagamento_status === "pago") return corsJson(req, 409, { error: "Este pedido já possui pagamento confirmado." });

  if (pedido.stripe_checkout_session_id) {
    try {
      const previousSession = await stripeRequest(
        "/checkout/sessions/" + encodeURIComponent(String(pedido.stripe_checkout_session_id)),
        "GET",
      );
      if (previousSession.status === "open" && typeof previousSession.url === "string") {
        return corsJson(req, 200, {
          url: previousSession.url,
          sessionId: previousSession.id,
          reused: true,
        });
      }
      if (previousSession.status === "complete" && pedido.pagamento_status !== "falhou") {
        // Checkout returning to the browser is not payment proof. A webhook must update the DB.
        return corsJson(req, 409, {
          code: "payment_pending",
          error: "O pagamento pode estar em processamento. Aguarde a confirmação antes de tentar novamente.",
        });
      }
    } catch (error) {
      console.warn("Previous Checkout Session could not be retrieved; preparing a fresh test session.");
    }
  }

  const { data: items, error: itemsError } = await admin
    .from("itens_pedido")
    .select("nome_produto, tamanho, cor, quantidade, preco_unitario")
    .eq("pedido_id", pedido.id)
    .limit(100);

  if (itemsError || !items || items.length < 1 || items.length > 100) {
    console.error("Stripe line-item lookup failed:", itemsError?.code ?? "invalid_count");
    return corsJson(req, 503, { error: "Não foi possível montar os itens do pedido." });
  }

  let calculatedCents = 0;
  const normalized: Array<{ name: string; unitAmount: number; quantity: number }> = [];
  for (const item of items) {
    const unit = Number(item.preco_unitario);
    const quantity = Number(item.quantidade);
    const unitAmount = Math.round(unit * 100);
    if (!Number.isFinite(unit) || unit <= 0 || !Number.isSafeInteger(unitAmount) ||
        !Number.isInteger(quantity) || quantity < 1 || quantity > 500) {
      return corsJson(req, 409, { error: "Os valores dos itens do pedido não podem ser cobrados com segurança." });
    }
    calculatedCents += unitAmount * quantity;
    const name = [item.nome_produto, item.tamanho, item.cor].filter(Boolean).join(" - ").slice(0, 240);
    normalized.push({ name, unitAmount, quantity });
  }

  const expectedCents = Math.round(Number(pedido.valor_total) * 100);
  if (!Number.isSafeInteger(calculatedCents) || calculatedCents !== expectedCents || expectedCents < 1) {
    console.error("Stripe amount validation failed for order:", pedido.id);
    return corsJson(req, 409, { error: "O total dos itens não corresponde ao total registrado no pedido." });
  }

  const attempt = Number(pedido.stripe_checkout_attempt || 0) + 1;
  if (!Number.isSafeInteger(attempt) || attempt < 1) return corsJson(req, 409, { error: "Número de tentativa inválido." });

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", safeSiteOrigin(req) + "/pagamento-retorno.html?session_id={CHECKOUT_SESSION_ID}");
  params.set("cancel_url", safeSiteOrigin(req) + "/pagamento-retorno.html?estado=cancelado&pedido_id=" + encodeURIComponent(pedido.id));
  params.set("client_reference_id", pedido.id);
  params.set("customer_email", String(pedido.email_cliente));
  params.set("locale", "pt-BR");
  params.set("billing_address_collection", "auto");
  params.set("metadata[order_id]", pedido.id);
  params.set("metadata[idempotency_key]", idempotencyKey);

  // Do not hard-code payment_method_types here: Stripe Checkout's dynamic payment
  // methods use the account's enabled/eligible methods. Pix appears for eligible
  // Brazilian accounts when enabled in Stripe settings; card remains available as configured.
  normalized.forEach((item, index) => {
    params.set("line_items[" + index + "][price_data][currency]", "brl");
    params.set("line_items[" + index + "][price_data][unit_amount]", String(item.unitAmount));
    params.set("line_items[" + index + "][price_data][product_data][name]", item.name);
    params.set("line_items[" + index + "][quantity]", String(item.quantity));
  });

  let session: Record<string, unknown>;
  try {
    session = await stripeRequest(
      "/checkout/sessions",
      "POST",
      params,
      "rocha7-checkout-" + pedido.id + "-" + attempt,
    );
  } catch (error) {
    return corsJson(req, 502, { error: error instanceof Error ? error.message : "Não foi possível iniciar o pagamento." });
  }

  const sessionId = typeof session.id === "string" ? session.id : "";
  const checkoutUrl = typeof session.url === "string" ? session.url : "";
  if (!/^cs_test_[A-Za-z0-9]+$/.test(sessionId) || !checkoutUrl.startsWith("https://checkout.stripe.com/")) {
    console.error("Stripe response did not include a valid test Checkout Session.");
    return corsJson(req, 502, { error: "O Stripe não retornou uma sessão de teste válida." });
  }

  const { data: updated, error: saveError } = await admin
    .from("pedidos")
    .update({
      stripe_checkout_session_id: sessionId,
      stripe_checkout_attempt: attempt,
      pagamento_status: "pendente",
      stripe_payment_intent_id: null,
      stripe_payment_method_type: null,
      pagamento_confirmado_em: null,
    })
    .eq("id", pedido.id)
    .eq("idempotencia_id", idempotencyKey)
    .neq("pagamento_status", "pago")
    .select("id")
    .maybeSingle();

  if (saveError || !updated) {
    console.error("Could not associate Stripe Checkout Session with order:", saveError?.code ?? "no_row");
    return corsJson(req, 503, { error: "A sessão foi criada, mas não foi possível associá-la ao pedido. Tente novamente; não crie outro pedido." });
  }

  return corsJson(req, 200, { url: checkoutUrl, sessionId, reused: false });
});
