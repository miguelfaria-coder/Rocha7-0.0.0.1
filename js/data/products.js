/* products.js - Dados Mock de Produtos e Regras de Precificação */

export const PRODUTOS = [
  {
    id: "prod-1",
    nome: "Camiseta Algodão Liso Premium",
    categoria: "camisa",
    estilo: "normal",
    tipoPersonalizacao: "lisa",
    precoBase: 35.00,
    imagem: "assets/img/produtos/t-shirt.png",
    descricao: "Camiseta 100% Algodão penteado fio 30.1. Toque macio, alta durabilidade e caimento perfeito para o dia a dia.",
    destaque: true,
    avaliacao: 5,
    cores: ["branco", "preto", "cinza", "azul-marinho"]
  },
  {
    id: "prod-2",
    nome: "Camiseta Estampada 'Fé & Rocha'",
    categoria: "camisa",
    estilo: "normal",
    tipoPersonalizacao: "pronta",
    precoBase: 45.00,
    imagem: "assets/img/produtos/camiseta-preta.svg",
    descricao: "Estampa exclusiva em Silk Screen de altíssima definição. Ideal para jovens e lideranças de ministério.",
    destaque: false,
    avaliacao: 5,
    cores: ["preto", "cinza"]
  },
  {
    id: "prod-3",
    nome: "Camiseta Personalizada para Eventos",
    categoria: "camisa",
    estilo: "normal",
    tipoPersonalizacao: "personalizavel",
    precoBase: 30.00, // Custo base de tecido R$30 + R$60 estampa diluída
    imagem: "assets/img/produtos/camiseta-branca.svg",
    descricao: "Envie sua arte ou crie no nosso editor. Quanto maior a quantidade da mesma arte, menor o preço unitário!",
    destaque: false,
    avaliacao: 5,
    cores: ["branco", "preto", "cinza", "azul-marinho"]
  },
  {
    id: "prod-4",
    nome: "Camisa Polo Tradicional Lisa",
    categoria: "camisa",
    estilo: "polo",
    tipoPersonalizacao: "lisa",
    precoBase: 55.00,
    imagem: "assets/img/produtos/polo-shirt.png",
    descricao: "Pique misto de alta gramatura com acabamento refinado nas mangas e gola.",
    destaque: true,
    avaliacao: 4,
    cores: ["azul-marinho", "preto", "branco"]
  },
  {
    id: "prod-5",
    nome: "Camisa Polo Personalizável em Malha Fria",
    categoria: "camisa",
    estilo: "polo",
    tipoPersonalizacao: "personalizavel",
    precoBase: 40.00,
    imagem: "assets/img/produtos/polo-azul.svg",
    descricao: "Ideal para equipes de recepção e diretoria de congressos. Aceita bordado ou estampa no peito.",
    destaque: false,
    avaliacao: 5,
    cores: ["azul-marinho", "preto", "branco"]
  },

  {
    id: "prod-8",
    nome: "Moletom Canguru Liso Flanelado",
    categoria: "moletom",
    estilo: "normal",
    tipoPersonalizacao: "lisa",
    precoBase: 110.00,
    imagem: "assets/img/produtos/foto_do_moleton.png",
    descricao: "Moletom 3 cabos flanelado quentinho com bolso frontal e cordão de ajuste no capuz.",
    destaque: true,
    avaliacao: 5,
    cores: ["preto", "cinza"]
  },
  {
    id: "prod-9",
    nome: "Moletom Canguru Personalizável",
    categoria: "moletom",
    estilo: "normal",
    tipoPersonalizacao: "personalizavel",
    precoBase: 100.00,
    imagem: "assets/img/produtos/moletom-preto.svg",
    descricao: "Moletom para retiros de inverno e acampamentos da igreja.",
    destaque: false,
    avaliacao: 5,
    cores: ["preto", "cinza"]
  },
  {
    id: "prod-10",
    nome: "Caneca Cerâmica Resina Premium 325ml",
    categoria: "caneca",
    estilo: "normal",
    tipoPersonalizacao: "personalizavel",
    precoBase: 28.00,
    imagem: "assets/img/produtos/mug.png",
    descricao: "Caneca de cerâmica branca com resina AAA para sublimação em altíssima durabilidade e brilho.",
    destaque: true,
    avaliacao: 5,
    cores: ["branco"]
  }
];
function normalizarTextoProduto(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/babylook/g, 'baby look').replace(/[-_]+/g, ' ').trim();
}

export function ehProdutoBabyLook(produto) {
  if (!produto) return false;
  if (['prod-6', 'prod-7'].includes(String(produto.id))) return true;
  const nome = normalizarTextoProduto(produto.nome);
  const categoria = normalizarTextoProduto(produto.categoria || produto.categoria_id);
  const estilo = normalizarTextoProduto(produto.estilo);
  return nome.includes('baby look') || categoria.includes('baby look') || estilo === 'baby look';
}

/**
 * Calcula o preço unitário diluindo o custo fixo de estampa conforme a quantidade total de peças
 * Regra: Preço = Base + (60.00 / Quantidade) para produtos personalizáveis
 */
export function calcularPrecoUnitario(produto, quantidade = 1) {
  const qtd = Math.max(1, parseInt(quantidade) || 1);
  if (produto.tipoPersonalizacao === "personalizavel") {
    const custoFixoEstampa = 60.00;
    const estampaPorPeca = custoFixoEstampa / qtd;
    return Math.round((produto.precoBase + estampaPorPeca) * 100) / 100;
  }
  return produto.precoBase;
}

/**
 * Busca a lista de produtos do Supabase (com fallback automático para a lista estática PRODUTOS)
 */
export async function carregarProdutos() {
  try {
    const supabaseModule = await import('../supabase.js');
    const produtosDb = await supabaseModule.buscarProdutosSupabase();

    if (produtosDb && Array.isArray(produtosDb) && produtosDb.length > 0) {
      return produtosDb.map(p => ({
        id: p.id,
        nome: p.nome,
        categoria: p.categoria_nome || p.categoria_id,
        categoriaId: p.categoria_id,
        estilo: p.estilo,
        tipoPersonalizacao: p.tipo_personalizacao,
        precoBase: parseFloat(p.preco_base),
        imagem: p.imagem,
        imagens: Array.isArray(p.imagens) ? p.imagens : (Array.isArray(p.galeria) ? p.galeria : []),
        imagensPorCor: p.imagens_por_cor || p.imagensPorCor || {},
        descricao: p.descricao,
        destaque: p.destaque,
        avaliacao: parseFloat(p.avaliacao || 5.0),
        avaliacoesCount: Number(p.avaliacoes_count || p.quantidade_avaliacoes || 0),
        cores: p.cores || []
      })).filter(produto => !ehProdutoBabyLook(produto));
    }
  } catch (err) {
    console.warn("Usando catálogo estático devido à ausência de dados do Supabase:", err);
  }

  return PRODUTOS.filter(produto => !ehProdutoBabyLook(produto));
}

if (typeof window !== 'undefined') {
  window.PRODUTOS = PRODUTOS;
  window.calcularPrecoUnitario = calcularPrecoUnitario;
  window.carregarProdutos = carregarProdutos;
}

