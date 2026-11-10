import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SECRET_KEYS = Deno.env.get("SUPABASE_SECRET_KEYS");
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  (SECRET_KEYS ? (() => { try { return JSON.parse(SECRET_KEYS).default ?? ""; } catch { return ""; } })() : "");
const ALLOWED_ORIGINS = new Set([
  "https://rocha7.devs.surf",
  "https://rocha7-0-0-0-1.pages.dev",
  "https://rocha7.miguel-faria-497.workers.dev",
  "https://rocha7.vercel.app",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
]);

function headersFor(origin: string) {
  const h = new Headers({
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  });
  if (origin && ALLOWED_ORIGINS.has(origin)) h.set("Access-Control-Allow-Origin", origin);
  return h;
}
function json(status: number, body: Record<string, unknown>, origin = "") {
  return new Response(JSON.stringify(body), { status, headers: headersFor(origin) });
}
function trimmed(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function decodeJwtRole(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
    return typeof payload.role === "string" ? payload.role : null;
  } catch { return null; }
}
async function hashIp(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(SERVICE_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(ip));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
function getClientIp(req: Request): string {
  const cf = (req.headers.get("cf-connecting-ip") || "").trim();
  const forwarded = (req.headers.get("x-forwarded-for") || "").split(",").map(x => x.trim()).filter(Boolean);
  const ip = cf || forwarded.at(-1) || "";
  if (!ip || ip.length > 100 || /[^0-9a-fA-F:.,%]/.test(ip)) return "";
  return ip;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") {
    if (!ALLOWED_ORIGINS.has(origin)) return json(403, { error: "Origem não autorizada." });
    return new Response("ok", { status: 200, headers: headersFor(origin) });
  }
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json(403, { error: "Origem não autorizada." }, origin);
  if (req.method !== "POST") return json(405, { error: "Método não permitido." }, origin);
  if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { error: "Serviço de contato indisponível." }, origin);

  const contentLength = Number(req.headers.get("content-length") || "0");
  if (contentLength > 32768) return json(413, { error: "Solicitação muito grande." }, origin);

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > 32768) return json(413, { error: "Solicitação muito grande." }, origin);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid body");
    body = parsed as Record<string, unknown>;
  } catch {
    return json(400, { error: "Corpo da solicitação inválido." }, origin);
  }

  const nome = trimmed(body.nome);
  const email = trimmed(body.email).toLowerCase();
  const telefone = trimmed(body.telefone);
  const mensagem = trimmed(body.mensagem);
  const phoneDigits = telefone.replace(/\D/g, "");
  if (nome.length < 2 || nome.length > 150 ||
      email.length < 5 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      telefone.length < 8 || telefone.length > 30 || phoneDigits.length < 8 || phoneDigits.length > 15 ||
      mensagem.length < 1 || mensagem.length > 10000 ||
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(mensagem)) {
    return json(400, { error: "Confira nome, e-mail, telefone e mensagem." }, origin);
  }

  const authorization = req.headers.get("authorization") || "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  const role = decodeJwtRole(bearer);
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  let userId: string | null = null;
  if (role === "authenticated") {
    const { data, error } = await db.auth.getUser(bearer);
    if (error || !data.user) return json(401, { error: "Sua sessão expirou. Entre novamente." }, origin);
    userId = data.user.id;
  } else if (role && role !== "anon") {
    return json(401, { error: "Credencial de autenticação inválida." }, origin);
  }

  const ip = getClientIp(req);
  if (!ip) return json(503, { error: "Não foi possível verificar a origem da solicitação. Tente novamente." }, origin);
  try {
    const ipHash = await hashIp(ip);
    const { data: allowed, error } = await db.rpc("rocha7_contact_allow_request", { p_ip_hash: ipHash });
    if (error) {
      console.error("Contact rate-limit failure:", error.message);
      return json(503, { error: "Envio temporariamente indisponível. Tente novamente." }, origin);
    }
    if (allowed !== true) return json(429, { error: "Muitas mensagens em pouco tempo. Aguarde dez minutos e tente novamente." }, origin);
  } catch {
    return json(503, { error: "Envio temporariamente indisponível. Tente novamente." }, origin);
  }

  const { error } = await db.from("mensagens_contato").insert({
    nome, email, telefone, mensagem, usuario_id: userId, status: "pendente", lido: false,
  });
  if (error) {
    console.error("Contact insert failed:", error.code || "unknown");
    return json(500, { error: "Não foi possível enviar a mensagem. Tente novamente." }, origin);
  }
  return json(200, { ok: true }, origin);
});
