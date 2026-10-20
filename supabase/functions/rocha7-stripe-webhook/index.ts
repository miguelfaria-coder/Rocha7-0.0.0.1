import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SECRET_KEYS = Deno.env.get("SUPABASE_SECRET_KEYS");
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  (SECRET_KEYS ? (() => { try { return JSON.parse(SECRET_KEYS).default ?? ""; } catch { return ""; } })() : "");
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

function safeEqualHex(expected: string, received: string): boolean {
  if (expected.length !== received.length || !/^[a-f0-9]+$/i.test(received)) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) {
    difference |= expected.charCodeAt(i) ^ received.charCodeAt(i);
  }
  return difference === 0;
}

async function verifyStripeSignature(rawBody: string, signatureHeader: string, secret: string): Promise<boolean> {
  if (!signatureHeader || !secret.startsWith("whsec_")) return false;
  const parts = signatureHeader.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || !/^[0-9]+$/.test(timestamp) || signatures.length === 0) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(timestamp + "." + rawBody),
  );
  const expected = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
  return signatures.some((signature) => safeEqualHex(expected, signature));
}

async function stripeGet(path: string): Promise<Record<string, unknown> | null> {
  if (!STRIPE_SECRET_KEY.startsWith("sk_test_")) return null;
  const response = await fetch("https://api.stripe.com/v1" + path, {
    method: "GET",
    headers: { "Authorization": "Basic " + btoa(STRIPE_SECRET_KEY + ":") },
  });
  if (!response.ok) {
    console.error("Stripe payment-intent lookup failed:", response.status);
    return null;
  }
  return await response.json() as Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!SUPABASE_URL || !SERVICE_KEY || !STRIPE_SECRET_KEY.startsWith("sk_test_") || !STRIPE_WEBHOOK_SECRET) {
    console.error("Stripe webhook is missing a required server-side test setting.");
    return new Response("Webhook configuration unavailable", { status: 500 });
  }

  const signature = req.headers.get("stripe-signature") || "";
  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).length > 1024 * 1024) {
    return new Response("Payload too large", { status: 413 });
  }

  let verified = false;
  try {
    verified = await verifyStripeSignature(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error("Stripe webhook signature verification failed.");
  }
  if (!verified) return new Response("Invalid Stripe signature", { status: 400 });

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (event.livemode !== false) return new Response("Live-mode events are disabled in this deployment", { status: 400 });

  const eventType = typeof event.type === "string" ? event.type : "";
  const data = event.data as { object?: Record<string, unknown> } | undefined;
  const session = data?.object;
  if (!session || typeof session.id !== "string") return new Response("Invalid event object", { status: 400 });

  const handledEvents = new Set([
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "checkout.session.expired",
  ]);
  if (!handledEvents.has(eventType)) return new Response(JSON.stringify({ received: true, ignored: true }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });

  const orderId = typeof (session.metadata as Record<string, unknown> | undefined)?.order_id === "string"
    ? String((session.metadata as Record<string, unknown>).order_id)
    : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId) ||
      session.client_reference_id !== orderId ||
      session.mode !== "payment" ||
      session.currency !== "brl" ||
      !/^cs_test_[A-Za-z0-9]+$/.test(String(session.id))) {
    console.error("Stripe webhook session metadata or environment did not match.");
    return new Response("Session validation failed", { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: order, error: orderError } = await admin
    .from("pedidos")
    .select("id, valor_total, pagamento_status, stripe_checkout_session_id")
    .eq("id", orderId)
    .eq("stripe_checkout_session_id", String(session.id))
    .maybeSingle();

  if (orderError) {
    console.error("Stripe webhook database lookup failed:", orderError.code);
    return new Response("Temporary database error", { status: 500 });
  }
  // Old, superseded, or unknown sessions must never change the current order.
  if (!order) return new Response(JSON.stringify({ received: true, ignored: true }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });

  const adminAmountCents = Math.round(Number(order.valor_total) * 100);
  const sessionAmountCents = Number(session.amount_total);
  if (!Number.isSafeInteger(adminAmountCents) || adminAmountCents < 1 ||
      sessionAmountCents !== adminAmountCents) {
    console.error("Stripe webhook amount did not match the stored order:", orderId);
    return new Response("Amount validation failed", { status: 400 });
  }

  if (eventType === "checkout.session.completed" ||
      eventType === "checkout.session.async_payment_succeeded") {
    // Pix can complete the Checkout Session before the payment settles.
    // Only a signed event with payment_status=paid may set payment to paid.
    if (session.payment_status !== "paid") {
      return new Response(JSON.stringify({ received: true, awaitingPayment: true }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    if (order.pagamento_status !== "pago") {
      let paymentIntentId: string | null = null;
      if (typeof session.payment_intent === "string") paymentIntentId = session.payment_intent;
      else if (session.payment_intent && typeof session.payment_intent === "object") {
        const pi = session.payment_intent as Record<string, unknown>;
        if (typeof pi.id === "string") paymentIntentId = pi.id;
      }

      let paymentMethodType: string | null = null;
      if (paymentIntentId && /^pi_[A-Za-z0-9]+$/.test(paymentIntentId)) {
        const pi = await stripeGet("/payment_intents/" + encodeURIComponent(paymentIntentId) + "?expand%5B%5D=payment_method");
        const pm = pi?.payment_method;
        if (pm && typeof pm === "object" && typeof (pm as Record<string, unknown>).type === "string") {
          paymentMethodType = String((pm as Record<string, unknown>).type).slice(0, 40);
        }
      }

      const { error: updateError } = await admin
        .from("pedidos")
        .update({
          pagamento_status: "pago",
          stripe_payment_intent_id: paymentIntentId,
          stripe_payment_method_type: paymentMethodType,
          pagamento_confirmado_em: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("stripe_checkout_session_id", String(session.id))
        .neq("pagamento_status", "pago");

      if (updateError) {
        console.error("Stripe webhook could not mark payment as paid:", updateError.code);
        return new Response("Could not update payment", { status: 500 });
      }
    }
  } else if (eventType === "checkout.session.async_payment_failed" || eventType === "checkout.session.expired") {
    if (order.pagamento_status !== "pago") {
      const { error: updateError } = await admin
        .from("pedidos")
        .update({ pagamento_status: "falhou" })
        .eq("id", orderId)
        .eq("stripe_checkout_session_id", String(session.id))
        .neq("pagamento_status", "pago");
      if (updateError) {
        console.error("Stripe webhook could not update failed payment:", updateError.code);
        return new Response("Could not update payment", { status: 500 });
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
