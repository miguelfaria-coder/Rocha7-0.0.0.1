import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SECRET_KEYS = Deno.env.get("SUPABASE_SECRET_KEYS");
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  (SECRET_KEYS ? (() => { try { return JSON.parse(SECRET_KEYS).default ?? ""; } catch { return ""; } })() : "");
const ALLOWED_STATUSES = new Set(["pendente", "confirmado", "em_producao", "enviado", "concluido", "cancelado"]);
const SELECTED_ORDER_FIELDS = "id, usuario_id, nome_cliente, email_cliente, telefone_whatsapp, endereco_entrega, cep, forma_pagamento, status, tipo_pedido, valor_total, observacoes, cpf_cliente, criado_em, atualizado_em";

function isAllowedOrigin(origin: string) {
  if (!origin) return true;
  if (origin === "https://rocha7.vercel.app" || origin === "http://localhost:5500" || origin === "http://127.0.0.1:5500") return true;
  return /^https:\/\/rocha7-[a-z0-9-]+\.vercel\.app$/.test(origin);
}

function headersFor(origin: string) {
  const headers = new Headers({
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  });
  if (origin && isAllowedOrigin(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

function json(status: number, body: Record<string, unknown>, origin = "") {
  return new Response(JSON.stringify(body), { status, headers: headersFor(origin) });
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function bad(message: string) {
  return { error: message };
}

async function requireAdmin(req: Request, db: ReturnType<typeof createClient>) {
  const header = req.headers.get("authorization") || "";
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  if (!token) return { error: "Entre com uma conta administrativa para continuar.", status: 401, userId: "" };

  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return { error: "Sua sessão expirou. Entre novamente.", status: 401, userId: "" };

  const { data: profile, error: profileError } = await db
    .from("perfis")
    .select("papel_id,status")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Admin profile authorization lookup failed:", profileError.message);
    return { error: "Não foi possível validar sua permissão.", status: 503, userId: "" };
  }
  if (!profile || Number(profile.papel_id) !== 1 || profile.status !== "ativo") {
    return { error: "Esta conta não tem permissão administrativa.", status: 403, userId: "" };
  }
  return { error: "", status: 200, userId: data.user.id };
}

async function dashboard(db: ReturnType<typeof createClient>) {
  const [orders, pending, products, customers, latest] = await Promise.all([
    db.from("pedidos").select("id", { count: "exact", head: true }),
    db.from("pedidos").select("id", { count: "exact", head: true }).eq("status", "pendente"),
    db.from("produtos").select("id", { count: "exact", head: true }),
    db.from("usuarios").select("id", { count: "exact", head: true }),
    db.from("pedidos").select("id,nome_cliente,email_cliente,status,valor_total,criado_em").order("criado_em", { ascending: false }).limit(8),
  ]);
  for (const result of [orders, pending, products, customers, latest]) {
    if (result.error) throw result.error;
  }
  return {
    stats: {
      orders: orders.count ?? 0,
      pending: pending.count ?? 0,
      products: products.count ?? 0,
      customers: customers.count ?? 0,
    },
    latestOrders: latest.data ?? [],
  };
}

async function listOrders(db: ReturnType<typeof createClient>) {
  const { data: orders, error } = await db.from("pedidos").select(SELECTED_ORDER_FIELDS).order("criado_em", { ascending: false }).limit(100);
  if (error) throw error;
  const orderIds = (orders ?? []).map((order: Record<string, unknown>) => order.id).filter(Boolean);
  const itemsByOrder: Record<string, unknown[]> = {};
  if (orderIds.length) {
    const { data: items, error: itemsError } = await db
      .from("itens_pedido")
      .select("pedido_id,nome_produto,tamanho,cor,quantidade,preco_unitario,subtotal")
      .in("pedido_id", orderIds)
      .order("criado_em", { ascending: true });
    if (itemsError) throw itemsError;
    for (const item of items ?? []) {
      const key = String(item.pedido_id);
      if (!itemsByOrder[key]) itemsByOrder[key] = [];
      itemsByOrder[key].push(item);
    }
  }
  return { orders: (orders ?? []).map((order: Record<string, unknown>) => ({ ...order, itens: itemsByOrder[String(order.id)] ?? [] })) };
}

async function listProducts(db: ReturnType<typeof createClient>) {
  const [products, categories] = await Promise.all([
    db.from("produtos").select("id,nome,categoria_id,estilo,tipo_personalizacao,preco_base,imagem,descricao,destaque,avaliacao,cores,atualizado_em").order("nome", { ascending: true }),
    db.from("categorias").select("id,nome,descricao").order("nome", { ascending: true }),
  ]);
  if (products.error) throw products.error;
  if (categories.error) throw categories.error;
  return { products: products.data ?? [], categories: categories.data ?? [] };
}

async function saveProduct(db: ReturnType<typeof createClient>, raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Dados do produto inválidos.");
  const input = raw as Record<string, unknown>;
  const productId = text(input.productId, 100);
  const name = text(input.nome, 160);
  const categoryId = text(input.categoria_id, 80);
  const image = text(input.imagem, 500);
  const style = text(input.estilo, 30);
  const personalization = text(input.tipo_personalizacao, 40);
  const description = text(input.descricao, 4000);
  const price = Number(input.preco_base);
  const colors = Array.isArray(input.cores)
    ? input.cores.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean).slice(0, 30).map((value) => value.slice(0, 40))
    : [];
  const featured = input.destaque === true;

  if (name.length < 2) throw new Error("Informe um nome de produto válido.");
  if (!Number.isFinite(price) || price < 0 || price > 1000000) throw new Error("Informe um preço entre R$ 0 e R$ 1.000.000.");
  if (!image || image.length > 500 || /[\u0000-\u001f]/.test(image)) throw new Error("Informe um caminho de imagem válido.");
  if (!["normal", "polo", "baby-look"].includes(style)) throw new Error("Estilo inválido.");
  if (!["lisa", "pronta", "personalizavel"].includes(personalization)) throw new Error("Tipo de personalização inválido.");

  const { data: category, error: categoryError } = await db.from("categorias").select("id").eq("id", categoryId).maybeSingle();
  if (categoryError) throw categoryError;
  if (!category) throw new Error("Selecione uma categoria existente.");

  const values = {
    nome: name,
    categoria_id: categoryId,
    estilo: style,
    tipo_personalizacao: personalization,
    preco_base: Math.round(price * 100) / 100,
    imagem: image,
    descricao: description,
    destaque: featured,
    cores,
    atualizado_em: new Date().toISOString(),
  };
  let query;
  if (productId) {
    query = await db.from("produtos").update(values).eq("id", productId)
      .select("id,nome,categoria_id,estilo,tipo_personalizacao,preco_base,imagem,descricao,destaque,avaliacao,cores,atualizado_em").maybeSingle();
  } else {
    const id = "prod-" + crypto.randomUUID();
    query = await db.from("produtos").insert({ ...values, id, avaliacao: 5 })
      .select("id,nome,categoria_id,estilo,tipo_personalizacao,preco_base,imagem,descricao,destaque,avaliacao,cores,atualizado_em").single();
  }
  if (query.error) throw query.error;
  if (!query.data) throw new Error("O produto não foi encontrado ou não pôde ser salvo.");
  return { product: query.data };
}

async function listCustomers(db: ReturnType<typeof createClient>) {
  const { data, error } = await db.from("usuarios").select("id,email,nome,telefone,created_at").order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return { customers: data ?? [] };
}

async function updateOrderStatus(db: ReturnType<typeof createClient>, rawId: unknown, rawStatus: unknown) {
  const orderId = text(rawId, 80);
  const status = text(rawStatus, 40);
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) throw new Error("Identificador de pedido inválido.");
  if (!ALLOWED_STATUSES.has(status)) throw new Error("Status não permitido.");
  const { data, error } = await db.from("pedidos")
    .update({ status, atualizado_em: new Date().toISOString() })
    .eq("id", orderId)
    .select("id,status,atualizado_em")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Pedido não encontrado.");
  return { order: data };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") {
    if (!isAllowedOrigin(origin)) return json(403, bad("Origem não autorizada."), "");
    return new Response("ok", { status: 200, headers: headersFor(origin) });
  }
  if (!isAllowedOrigin(origin)) return json(403, bad("Origem não autorizada."), "");

  if (req.method !== "POST") return json(405, bad("Método não permitido."), origin);
  if (!SUPABASE_URL || !SERVICE_KEY) return json(500, bad("Serviço administrativo indisponível."), origin);
  const contentLength = Number(req.headers.get("content-length") || "0");
  if (contentLength > 128 * 1024) return json(413, bad("Solicitação muito grande."), origin);

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > 128 * 1024) return json(413, bad("Solicitação muito grande."), origin);
    body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid body");
  } catch {
    return json(400, bad("Corpo da solicitação inválido."), origin);
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const authorization = await requireAdmin(req, db);
  if (authorization.status !== 200) return json(authorization.status, bad(authorization.error), origin);

  try {
    let result: Record<string, unknown>;
    switch (body.action) {
      case "dashboard":
        result = await dashboard(db);
        break;
      case "list_orders":
        result = await listOrders(db);
        break;
      case "update_order_status":
        result = await updateOrderStatus(db, body.orderId, body.status);
        break;
      case "list_products":
        result = await listProducts(db);
        break;
      case "save_product":
        result = await saveProduct(db, body.product);
        break;
      case "list_customers":
        result = await listCustomers(db);
        break;
      default:
        return json(400, bad("Operação administrativa inválida."), origin);
    }
    return json(200, result, origin);
  } catch (error) {
    console.error("Rocha7 admin operation failed:", error instanceof Error ? error.message : "unknown error");
    const safeMessage = error instanceof Error &&
      ["Informe um nome de produto válido.", "Informe um preço entre R$ 0 e R$ 1.000.000.", "Informe um caminho de imagem válido.", "Estilo inválido.", "Tipo de personalização inválido.", "Selecione uma categoria existente.", "Identificador de pedido inválido.", "Status não permitido.", "Pedido não encontrado.", "Dados do produto inválidos."].includes(error.message)
      ? error.message
      : "Não foi possível concluir a operação administrativa.";
    return json(400, bad(safeMessage), origin);
  }
});