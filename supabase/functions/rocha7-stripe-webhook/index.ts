import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SECRET_KEYS = Deno.env.get("SUPABASE_SECRET_KEYS");
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  (SECRET_KEYS ? (() => { try { return JSON.parse(SECRET_KEYS).default ?? ""; } catch { return ""; } })() : "");
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

async function verifySignature(payload: string, header: string, secret: string): Promise<boolean> {
  const parts = header.split(",").map((part) => part.split("=", 2));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || signatures.length === 0 || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${payload}`)));
  const expected = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return signatures.some((candidate) => {
    if (!/^[a-f0-9]{64}$/i.test(candidate)) return false;
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ candidate.toLowerCase().charCodeAt(i);
    return mismatch === 0;
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!SUPABASE_URL || !SERVICE_KEY || !STRIPE_SECRET_KEY || !WEBHOOK_SECRET) {
    return new Response("Webhook is not configured", { status: 503 });
  }

  const payload = await req.text();
  const signature = req.headers.get("stripe-signature") || "";
  if (!(await verifySignature(payload, signature, WEBHOOK_SECRET))) {
    return new Response("Invalid signature", { status: 400 });
  }

  let event: Record<string, any>;
  try { event = JSON.parse(payload); } catch { return new Response("Invalid payload", { status: 400 }); }
  const supported = new Set([
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "checkout.session.expired",
  ]);
  if (!supported.has(event.type)) return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });

  const session = event.data?.object;
  const orderId = String(session?.metadata?.pedido_id || session?.client_reference_id || "");
  if (!orderId || !String(session?.id || "").startsWith("cs_")) {
    return new Response("Missing order/session reference", { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: order, error: readError } = await admin.from("pedidos")
    .select("id, stripe_session_id, valor_total, status_pagamento").eq("id", orderId).maybeSingle();
  if (readError || !order) return new Response("Order not found", { status: 404 });
  if (order.stripe_session_id && order.stripe_session_id !== session.id) {
    return new Response("Session does not match order", { status: 400 });
  }
  if (order.status_pagamento === "pago") {
    return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
  }

  let status = "pendente";
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    // For delayed payment methods, completed can still be unpaid; wait for async success.
    if (session.payment_status === "paid" || event.type === "checkout.session.async_payment_succeeded") {
      const expectedAmount = Math.round(Number(order.valor_total) * 100);
      if (session.currency !== "brl" || Number(session.amount_total) !== expectedAmount) {
        console.error("Stripe amount/currency mismatch for order", orderId);
        return new Response("Payment amount mismatch", { status: 400 });
      }
      status = "pago";
    }
  } else if (event.type === "checkout.session.async_payment_failed") {
    status = "falhou";
  } else if (event.type === "checkout.session.expired") {
    status = "expirado";
  }

  const { error } = await admin.from("pedidos").update({
    status_pagamento: status,
    stripe_session_id: session.id,
    stripe_payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : null,
  }).eq("id", order.id);
  if (error) {
    console.error("Stripe webhook database update failed:", error.message);
    return new Response("Database update failed", { status: 500 });
  }
  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
