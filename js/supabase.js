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
export async function loginComGoogle() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase não configurado no js/supabase.js");
  }

  // Redireciona para index.html após autenticação com o Google
  let redirectUrl = window.location.href;
  if (redirectUrl.includes('login.html')) {
    redirectUrl = redirectUrl.replace('login.html', 'index.html');
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account'
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
 * Pedidos - Registra um novo pedido no Supabase
 */
export async function criarPedidoSupabase(dadosPedido, itens) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase não inicializado");

  // 1. Inserir o pedido principal na tabela 'pedidos'
  const { data: pedidoCriado, error: erroPedido } = await supabase
    .from('pedidos')
    .insert([{
      usuario_id: dadosPedido.usuarioId || null,
      nome_cliente: dadosPedido.nome,
      email_cliente: dadosPedido.email,
      telefone_whatsapp: dadosPedido.telefone,
      endereco_entrega: dadosPedido.endereco,
      cep: dadosPedido.cep,
      forma_pagamento: dadosPedido.formaPagamento,
      tipo_pedido: dadosPedido.tipoPedido || 'varejo',
      valor_total: dadosPedido.valorTotal,
      observacoes: dadosPedido.observacoes || null
    }])
    .select()
    .single();

  if (erroPedido) throw erroPedido;

  // 2. Mapear os itens para inserção na tabela 'itens_pedido'
  const itensFormatados = itens.map(item => ({
    pedido_id: pedidoCriado.id,
    produto_id: item.id && item.id.startsWith('prod-') ? item.id : null,
    nome_produto: item.nome,
    tamanho: item.tamanho,
    cor: item.cor,
    quantidade: item.quantidade,
    preco_unitario: item.precoUnitario,
    detalhes_design: item.customDesign || null
  }));

  const { error: erroItens } = await supabase
    .from('itens_pedido')
    .insert(itensFormatados);

  if (erroItens) throw erroItens;

  return pedidoCriado;
}

/**
 * Contato - Salva mensagem de contato no Supabase
 */
export async function enviarMensagemContatoSupabase(dados) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase não inicializado");

  const payload = {
    nome: dados.nome,
    email: dados.email,
    telefone: dados.telefone,
    mensagem: dados.mensagem
  };

  if (dados.usuarioId) {
    payload.usuario_id = dados.usuarioId;
  }

  const { error } = await supabase
    .from('mensagens_contato')
    .insert(payload);

  if (error) throw error;
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

