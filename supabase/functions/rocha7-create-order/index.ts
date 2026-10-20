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
  "Cache-Control": "no-store, max-age=0",
  "Vary": "Origin",
  "X-Content-Type-Options": "nosniff",
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const trimmed = (value: unknown, max: number): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

function decodeJwtRole(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

async function hashIp(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SERVICE_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(ip));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function validateOrder(order: unknown, items: unknown, key: unknown) {
  if (!order || typeof order !== "object" || Array.isArray(order)) throw new Error("Dados do pedido inválidos.");
  if (!Array.isArray(items) || items.length < 1 || items.length > 30) throw new Error("O pedido deve conter de 1 a 30 linhas.");
  if (typeof key !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
    throw new Error("Chave de envio inválida. Atualize a página e tente novamente.");
  }

  const o = order as Record<string, unknown>;
  const nome = trimmed(o.nome, 150);
  const email = trimmed(o.email, 254).toLowerCase();
  const telefone = trimmed(o.telefone, 30);
  const cpf = trimmed(o.cpf, 20);
  const endereco = trimmed(o.endereco, 500);
  const cep = trimmed(o.cep, 12);
  const payment = trimmed(o.formaPagamento, 20);
  const orderType = trimmed(o.tipoPedido || "varejo", 20);
  const phoneDigits = telefone.replace(/\D/g, "");
  const cpfDigits = cpf.replace(/\D/g, "");
  const cepDigits = cep.replace(/\D/g, "");

  if (nome.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      phoneDigits.length < 8 || phoneDigits.length > 15 ||
      ![11, 14].includes(cpfDigits.length) || cepDigits.length !== 8 ||
      endereco.length < 5 || !["pix", "boleto", "cartao"].includes(payment) ||
      !["varejo", "lote"].includes(orderType)) {
    throw new Error("Confira nome, e-mail, telefone, CPF/CNPJ, endereço, CEP e forma de pagamento.");
  }

  let totalQuantity = 0;
  const normalizedItems = items.map((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new Error("Item inválido.");
    const item = candidate as Record<string, unknown>;
    const id = trimmed(item.id, 80);
    const tamanho = trimmed(item.tamanho, 30);
    const cor = trimmed(item.cor, 50);
    const quantity = Number(item.quantidade);
    if (!id || !tamanho || !cor || !Number.isInteger(quantity) || quantity < 1 || quantity > 500) {
      throw new Error("Um produto, tamanho, cor ou quantidade está inválido.");
    }
    totalQuantity += quantity;
    if (totalQuantity > 1000) throw new Error("O pedido excede o limite de 1.000 peças pelo checkout.");
    const design = item.customDesign ?? null;
    if (design !== null && (typeof design !== "object" || Array.isArray(design))) throw new Error("Dados de personalização inválidos.");
    if (new TextEncoder().encode(JSON.stringify(design)).length > 20000) throw new Error("Os dados de personalização excedem o limite.");
    return { id, tamanho, cor, quantidade: quantity, customDesign: design };
  });

  return {
    order: {
      nome,
      email,
      telefone,
      cpf,
      endereco,
      cep,
      formaPagamento: payment,
      tipoPedido: orderType,
      observacoes: trimmed(o.observacoes, 2000),
    },
    items: normalizedItems,
    idempotencyKey: key.toLowerCase(),
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") {
    if (origin !== "https://rocha7.vercel.app") return json(403, { error: "Origem não autorizada." });
    return new Response("ok", { headers: corsHeaders });
  }
  if (origin && origin !== "https://rocha7.vercel.app") return json(403, { error: "Origem não autorizada." });
  if (req.method !== "POST") return json(405, { error: "Método não permitido." });
  if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { error: "Checkout indisponível: configuração interna ausente." });

  const contentLength = Number(req.headers.get("content-length") || "0");
  if (contentLength > 65536) return json(413, { error: "Solicitação muito grande." });

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > 65536) return json(413, { error: "Solicitação muito grande." });
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "Corpo da solicitação inválido." });
  }

  let validated: ReturnType<typeof validateOrder>;
  try {
    validated = validateOrder(body.order, body.items, body.idempotencyKey);
  } catch (error) {
    return json(400, { error: error instanceof Error ? error.message : "Dados inválidos." });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let userId: string | null = null;
  const authorization = req.headers.get("authorization") || "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  const role = decodeJwtRole(bearer);
  if (role === "authenticated") {
    const { data, error } = await admin.auth.getUser(bearer);
    if (error || !data.user) return json(401, { error: "Sua sessão expirou. Entre novamente e tente de novo." });
    userId = data.user.id;
  } else if (role && role !== "anon") {
    return json(401, { error: "Credencial de autenticação inválida." });
  }

  // Não permitir bypass do limitador por ausência de IP reconhecido pelo gateway.
  // Em X-Forwarded-For, usar o último endereço inserido pelo proxy mais próximo.
  const forwarded = (req.headers.get("x-forwarded-for") || "").split(",").map((value) => value.trim()).filter(Boolean);
  // Evita confiar em x-real-ip, que pode ser fornecido pelo próprio cliente.
  const ip = (req.headers.get("cf-connecting-ip") || forwarded.at(-1) || "").trim();
  if (!ip || ip.length > 100 || /[^0-9a-fA-F:.,%]/.test(ip)) {
    return json(503, { error: "Não foi possível verificar a origem da solicitação. Tente novamente." });
  }
  {
    try {
      const ipHash = await hashIp(ip);
      const { data: allowed, error: rateError } = await admin.rpc("rocha7_checkout_allow_request", { p_ip_hash: ipHash });
      if (rateError) {
        console.error("Checkout rate-limit failure:", rateError.message);
        return json(503, { error: "Checkout temporariamente indisponível. Tente novamente." });
      }
      if (allowed !== true) return json(429, { error: "Muitas tentativas em pouco tempo. Aguarde um minuto e tente novamente." });
    } catch (error) {
      console.error("Checkout rate-limit failure:", error);
      return json(503, { error: "Checkout temporariamente indisponível. Tente novamente." });
    }
  }

  const { data, error } = await admin.rpc("rocha7_create_order_secure", {
    p_order: validated.order,
    p_items: validated.items,
    p_user_id: userId,
    p_idempotency_key: validated.idempotencyKey,
  });

  if (error) {
    if (error.code === "23505") {
      let query = admin.from("pedidos").select("id, valor_total").eq("idempotencia_id", validated.idempotencyKey);
      query = userId ? query.eq("usuario_id", userId) : query.is("usuario_id", null);
      const { data: existing } = await query.maybeSingle();
      if (existing) return json(200, { pedido: { ...existing, repetido: true } });
    }
    console.error("Secure checkout database failure:", error.code, error.message);
    const clientError = ["22023", "23514", "23503"].includes(error.code || "");
    return json(clientError ? 400 : 500, {
      error: clientError ? "Não foi possível validar os dados do pedido. Confira as informações." : "Não foi possível registrar o pedido. Tente novamente.",
    });
  }

  return json(200, { pedido: data });
});
