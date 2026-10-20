import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SECRET_KEYS = Deno.env.get("SUPABASE_SECRET_KEYS");
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  (SECRET_KEYS ? (() => { try { return JSON.parse(SECRET_KEYS).default ?? ""; } catch { return ""; } })() : "");
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://rocha7.vercel.app",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") return origin === "https://rocha7.vercel.app"
    ? new Response("ok", { headers: corsHeaders })
    : json(403, { error: "Origem não autorizada." });
  if (origin && origin !== "https://rocha7.vercel.app") return json(403, { error: "Origem não autorizada." });
  if (req.method !== "POST") return json(405, { error: "Método não permitido." });
  if (!SUPABASE_URL || !SERVICE_KEY) return json(503, { error: "Consulta de pagamento indisponível." });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: "Solicitação inválida." }); }
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) return json(400, { error: "Sessão inválida." });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.from("pedidos")
    .select("id, status_pagamento, valor_total")
    .eq("stripe_session_id", sessionId).maybeSingle();
  if (error || !data) return json(404, { error: "Pedido ainda não localizado. Aguarde alguns segundos e atualize." });
  return json(200, { status: data.status_pagamento || "pendente", pedidoId: data.id, valorTotal: data.valor_total });
});
