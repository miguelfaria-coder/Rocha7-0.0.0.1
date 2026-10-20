/* supabase.js - Configuração e Cliente do Supabase para Agência Rocha7 */

// ============================================================
// CREDENCIAIS DO SUPABASE
// Substitua pelas credenciais encontradas no seu Supabase Console:
// Project Settings -> API
// ============================================================
const SUPABASE_URL = window.SUPABASE_URL || "https://tqixpmfpqegxkfwqxasa.supabase.co";
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "sb_publishable_o7zmdOGsLtPWdqTGovFT4Q_vzQE-_G7";

let supabaseClient = null;

/**
 * Inicializa e retorna o cliente do Supabase
 */
export function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
    // Se a URL ainda for o placeholder, alerta no console
    if (SUPABASE_URL.includes("SEU_PROJETO")) {
      console.warn("⚠️ Supabase não configurado! Atualize SUPABASE_URL e SUPABASE_ANON_KEY no arquivo js/supabase.js com as credenciais do seu projeto Supabase.");
      return null;
    }
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabaseClient;
  } else {
    console.error("❌ SDK do Supabase não encontrado na página. Verifique se o script da CDN foi incluído.");
    return null;
  }
}

/**
 * Autenticação - Realiza login do usuário com e-mail e senha
 */
export async function loginUsuario(email, senha) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase não configurado no js/supabase.js");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: senha
  });

  if (error) throw error;
  return data;
}

/**
 * Autenticação - Cadastra um novo usuário com perfil
 */
export async function cadastrarUsuario(email, senha, nome, telefone) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase não configurado no js/supabase.js");
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: {
      data: {
        nome: nome,
        telefone: telefone
      }
    }
  });

  if (error) throw error;
  return data;
}

/**
 * Autenticação - Login com Conta do Google (OAuth)
 */
/**
 * Retorna um redirect de OAuth explícito e restrito às origens que a aplicação utiliza.
 * Qualquer outro host cai no domínio oficial, evitando redirecionamentos arbitrários.
 */
function obterRedirectGoogle() {
  const productionOrigin = "https://rocha7.vercel.app";
  const localOrigins = new Set([
    "http://localhost:5500",
    "http://127.0.0.1:5500"
  ]);
  const currentOrigin = window.location.origin;
  const redirectOrigin = currentOrigin === productionOrigin || localOrigins.has(currentOrigin)
    ? currentOrigin
    : productionOrigin;
  return new URL("/index.html", redirectOrigin).toString();
}

/**
 * Cadastro e login com Google usam o mesmo fluxo OAuth do Supabase:
 * se a conta ainda não existe, o Auth cria o usuário; se existe, inicia a sessão.
 */
export async function loginComGoogle() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase não configurado no js/supabase.js");
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: obterRedirectGoogle(),
      queryParams: {
        prompt: "select_account"
      }
    }
  });

  if (error) throw error;
  return data;
}

/**
 * Autenticação - Encerra a sessão do usuário
 */
export async function logoutUsuario() {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) console.error("Erro no logout:", error);
}

/**
 * Autenticação - Retorna o usuário logado atualmente
 */
export async function obterUsuarioAtual() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Perfil - Busca os dados de cadastro e entrega do usuário (CPF, endereço, telefone, etc.)
 */
export async function obterPerfilUsuario(userId) {
  const supabase = getSupabaseClient();
  if (!supabase || !userId) return null;

  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.warn("Aviso ao buscar perfil de usuário:", error.message);
    return null;
  }
  return data;
}

/**
 * Perfil - Atualiza os dados cadastrais (CPF, endereço, telefone, etc.) para compras
 */
export async function atualizarPerfilUsuario(userId, dadosPerfil) {
  const supabase = getSupabaseClient();
  if (!supabase || !userId) throw new Error("Usuário ou Supabase não configurado");

  const { data, error } = await supabase
    .from('usuarios')
    .update(dadosPerfil)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Listener automático de autenticação para sincronizar logins do Google e e-mail
 */
export function inicializarAuthListener() {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session && session.user) {
      const u = session.user;
      const meta = u.user_metadata || {};
      const nome = meta.nome || meta.full_name || meta.name || u.email.split('@')[0];
      const userObj = {
        id: u.id,
        nome: nome,
        email: u.email,
        avatar_url: meta.avatar_url || meta.picture || null
      };
      localStorage.setItem('r7_user', JSON.stringify(userObj));
      window.dispatchEvent(new Event('user-state-changed'));
    } else if (event === 'SIGNED_OUT') {
      localStorage.removeItem('r7_user');
      window.dispatchEvent(new Event('user-state-changed'));
    }
  });
}


/**
 * Catálogo - Busca os produtos cadastrados no banco Supabase
 */
export async function buscarProdutosSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .order('nome');

  if (error) {
    console.error("Erro ao buscar produtos do Supabase:", error);
    return null;
  }
  return data;
}

/**
 * Pedidos - Usa o endpoint seguro do servidor.
 * O navegador envia apenas escolhas e quantidades; nomes/preços são recalculados no backend.
 */
export async function criarPedidoSupabase(dadosPedido, itens) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase não inicializado");

  const { data, error } = await supabase.functions.invoke("rocha7-create-order", {
    body: {
      order: {
        nome: dadosPedido.nome,
        email: dadosPedido.email,
        telefone: dadosPedido.telefone,
        cpf: dadosPedido.cpf,
        endereco: dadosPedido.endereco,
        cep: dadosPedido.cep,
        formaPagamento: dadosPedido.formaPagamento,
        tipoPedido: dadosPedido.tipoPedido || "varejo",
        observacoes: dadosPedido.observacoes || ""
      },
      items: itens.map(item => ({
        id: item.id,
        tamanho: item.tamanho,
        cor: item.cor,
        quantidade: item.quantidade,
        customDesign: item.customDesign || null
      })),
      idempotencyKey: dadosPedido.idempotenciaId
    }
  });

  if (error) throw error;
  if (!data?.pedido?.id || !Number.isFinite(Number(data.pedido.valor_total))) {
    throw new Error("O servidor não retornou uma confirmação válida do pedido.");
  }
  return data.pedido;
}

/**
 * Contato - Envia mensagem pelo endpoint server-side protegido.
 * O backend valida os campos, limita tentativas por IP e determina usuario_id pela sessão validada.
 */
export async function enviarMensagemContatoSupabase(dados) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase não inicializado");

  const { data, error } = await supabase.functions.invoke("rocha7-contact-message", {
    body: {
      nome: dados.nome,
      email: dados.email,
      telefone: dados.telefone,
      mensagem: dados.mensagem
    }
  });

  if (error) throw error;
  if (data?.ok !== true) throw new Error("O servidor não confirmou o envio da mensagem.");
  return true;
}

if (typeof window !== 'undefined') {
  window.Rocha7Supabase = {
    getSupabaseClient,
    loginUsuario,
    cadastrarUsuario,
    loginComGoogle,
    logoutUsuario,
    obterUsuarioAtual,
    obterPerfilUsuario,
    atualizarPerfilUsuario,
    buscarProdutosSupabase,
    criarPedidoSupabase,
    enviarMensagemContatoSupabase
  };

  // Inicia sincronização de sessão automaticamente
  inicializarAuthListener();
}

