/* =============================================================
   catalogo.js — Catálogo Editorial Rocha7
   ============================================================= */
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { carregarProdutos, ehProdutoBabyLook } from '../data/products.js';
import { cart } from '../cart.js';
import { escapeHtml, formatBRL } from '../utils.js';

/* ── Configuração Única de Modelagens e Tamanhos ─────────────
   Fácil de editar: inclua ou remova tamanhos aqui sem mexer
   no restante do código.
───────────────────────────────────────────────────────────── */
export const CONFIG_MODELAGENS = {
  classico: {
    id: 'classico',
    nome: 'Clássico',
    tamanhos: ['PP', 'P', 'M', 'G', 'GG', 'XP', 'XM', 'XG', 'G1', 'G2', 'G3']
  },
  babyLook: {
    id: 'babyLook',
    nome: 'Baby Look',
    tamanhos: ['PP', 'P', 'M', 'G', 'GG']
  }
};

/* ── Tabela de Medidas (Guia de Medidas) ───────────────────── */
export const TABELA_MEDIDAS = {
  classico: {
    id: 'classico',
    titulo: 'Modelagem Clássica (Unissex)',
    linhas: [
      { tamanho: 'PP', largura: '—', comprimento: '—' },
      { tamanho: 'P', largura: '51 cm', comprimento: '70 cm' },
      { tamanho: 'M', largura: '55 cm', comprimento: '74 cm' },
      { tamanho: 'G', largura: '59 cm', comprimento: '78 cm' },
      { tamanho: 'GG', largura: '63 cm', comprimento: '82 cm' },
      { tamanho: 'XP / G1', largura: '68 cm', comprimento: '85 cm' },
      { tamanho: 'XM / G2', largura: '70 cm', comprimento: '85 cm' },
      { tamanho: 'XG / G3', largura: '78 cm', comprimento: '90 cm' }
    ]
  },
  babyLook: {
    id: 'babyLook',
    titulo: 'Modelagem Baby Look (Feminina)',
    linhas: [
      { tamanho: 'PP', largura: '—', comprimento: '—' },
      { tamanho: 'P', largura: '40 cm', comprimento: '62 cm' },
      { tamanho: 'M', largura: '41 cm', comprimento: '63 cm' },
      { tamanho: 'G', largura: '46 cm', comprimento: '67 cm' },
      { tamanho: 'GG', largura: '47 cm', comprimento: '70 cm' }
    ]
  },
  nota: 'Medidas aproximadas, podem variar em até 2 cm. Largura medida de axila a axila, comprimento medido do ombro à barra.'
};

/* ── Mapa de cores hex ─────────────────────────────────────── */
const COR_HEX = {
  'branco':      '#FFFFFF',
  'preto':       '#222222',
  'cinza':       '#888888',
  'azul-marinho':'#1a2e5a',
  'rosa':        '#f4a7b9',
};

/* ── Estado global do catálogo ─────────────────────────────── */
let PRODUTOS = [];
let estado = {
  categoria:          'todos',
  estilo:             'todos',
  tipoPersonalizacao: 'todos',
  ordenacao:          'nome',
  busca:              '',
  filtrosAtivos:      0,
};

/* ── Estado de escolhas de cada card (modelagem, tamanho, cor) */
export const estadoCards = {};

export function obterEstadoPedido(produtoId) {
  return estadoCards[produtoId] ? { ...estadoCards[produtoId] } : null;
}

/* ── Lê parâmetros da URL ──────────────────────────────────── */
const params = new URLSearchParams(window.location.search);
if (params.get('categoria')) estado.categoria = params.get('categoria');

/* ── Conteúdo dinâmico da faixa compacta de categoria ──────── */
const BANNER_CATEGORIAS = {
  todos: {
    titulo: 'Catálogo',
    subtitulo: 'Camisetas, moletons e canecas para igrejas e ministérios',
    tipoVisual: 'multi',
    fotos: [
      { src: 'assets/img/produtos/caneca-branca.png', alt: 'Caneca', classe: 'photo-left' },
      { src: 'assets/img/produtos/camiseta-branca.png', alt: 'Camiseta', classe: 'photo-center' },
      { src: 'assets/img/produtos/moletom-preto.png', alt: 'Moletom', classe: 'photo-right' }
    ]
  },
  camisa: {
    titulo: 'Camisetas',
    subtitulo: 'Lisas ou personalizadas, em lote para sua igreja',
    tipoVisual: 'single',
    fotos: [
      { src: 'assets/img/produtos/camiseta-branca.png', alt: 'Camiseta', classe: 'photo-single' }
    ]
  },
  moletom: {
    titulo: 'Moletons',
    subtitulo: 'Conforto e identidade para o seu ministério',
    tipoVisual: 'single',
    fotos: [
      { src: 'assets/img/produtos/moletom-preto.png', alt: 'Moletom', classe: 'photo-single' }
    ]
  },
  caneca: {
    titulo: 'Canecas',
    subtitulo: 'Lembranças personalizadas para eventos e campanhas',
    tipoVisual: 'single',
    fotos: [
      { src: 'assets/img/produtos/caneca-branca.png', alt: 'Caneca', classe: 'photo-single' }
    ]
  }
};

let bannerCurrentCat = null;

function atualizarBannerCategoria(categoria, animar = true) {
  const dados = BANNER_CATEGORIAS[categoria] || BANNER_CATEGORIAS.todos;
  const contentEl = document.getElementById('cat-banner-content');
  const titleEl = document.getElementById('cat-banner-title');
  const subEl = document.getElementById('cat-banner-sub');
  const visualEl = document.getElementById('cat-banner-visual');

  if (!contentEl || !titleEl || !subEl || !visualEl) return;

  if (bannerCurrentCat === categoria) return;
  bannerCurrentCat = categoria;

  const aplicarDados = () => {
    titleEl.textContent = dados.titulo;
    subEl.textContent = dados.subtitulo;

    visualEl.className = 'cat-banner-visual ' + (dados.tipoVisual === 'multi' ? 'multi-item' : 'single-item');
    visualEl.innerHTML = dados.fotos.map(f => `
      <div class="cat-photo-card ${escapeHtml(f.classe)}">
        <img src="${escapeHtml(f.src)}" alt="${escapeHtml(f.alt)}" loading="lazy">
      </div>
    `).join('');
  };

  if (!animar) {
    aplicarDados();
    return;
  }

  contentEl.classList.add('fading');
  setTimeout(() => {
    aplicarDados();
    contentEl.classList.remove('fading');
  }, 150);
}

/* ── Remove Baby Look como item de compra independente ─────── */
function removerProdutosBabyLook(lista) {
  if (!Array.isArray(lista)) return [];
  return lista.filter(produto => produto && !ehProdutoBabyLook(produto));
}

/* ── Init ──────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  renderHeader();
  renderFooter();

  try {
    const listaOriginal = await carregarProdutos();
    PRODUTOS = removerProdutosBabyLook(listaOriginal);
  } catch (e) {
    console.warn('Usando produtos estáticos filtrados:', e);
    const { PRODUTOS: P } = await import('../data/products.js');
    PRODUTOS = removerProdutosBabyLook(P);
  }

  initUI();
  atualizarBannerCategoria(estado.categoria, false);
  renderGrid();
});

/* ── Inicializa UI ─────────────────────────────────────────── */
function initUI() {
  /* Tabs de categoria */
  const tabs = document.querySelectorAll('.cat-tab');
  tabs.forEach(tab => {
    if (tab.dataset.cat === estado.categoria) tab.classList.add('active');
    else tab.classList.remove('active');

    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      estado.categoria = tab.dataset.cat;
      // Sincroniza radio do drawer
      const radio = document.querySelector(`input[name="f-categoria"][value="${estado.categoria}"]`);
      if (radio) radio.checked = true;
      atualizarBannerCategoria(estado.categoria, true);
      renderGrid();
    });
  });

  /* Drawer de filtros */
  document.getElementById('btn-filtrar')
    ?.addEventListener('click', () => toggleFiltrosDrawer(true));
  document.getElementById('filtros-close')
    ?.addEventListener('click', () => toggleFiltrosDrawer(false));
  document.getElementById('filtros-overlay')
    ?.addEventListener('click', () => toggleFiltrosDrawer(false));

  /* Aplicar filtros */
  document.getElementById('btn-aplicar-filtros')?.addEventListener('click', () => {
    const cat = document.querySelector('input[name="f-categoria"]:checked')?.value || 'todos';
    const est = document.querySelector('input[name="f-estilo"]:checked')?.value   || 'todos';
    const tip = document.querySelector('input[name="f-tipo"]:checked')?.value     || 'todos';

    estado.estilo             = est;
    estado.tipoPersonalizacao = tip;

    if (cat !== estado.categoria) {
      estado.categoria = cat;
      document.querySelectorAll('.cat-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.cat === cat);
      });
      atualizarBannerCategoria(estado.categoria, true);
    }

    contarFiltros();
    renderGrid();
    toggleFiltrosDrawer(false);
  });

  /* Limpar filtros */
  ['btn-limpar-filtros', 'btn-limpar-vazio'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', limparFiltros);
  });

  /* Dropdown de ordenação */
  const btnOrdenar  = document.getElementById('btn-ordenar');
  const dropOrdenar = document.getElementById('ordenar-dropdown');

  btnOrdenar?.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = btnOrdenar.getBoundingClientRect();
    dropOrdenar.style.top  = (rect.bottom + 8 + window.scrollY) + 'px';
    dropOrdenar.style.left = rect.left + 'px';
    dropOrdenar.classList.toggle('active');
  });

  document.addEventListener('click', () => dropOrdenar?.classList.remove('active'));

  document.querySelectorAll('.ordenar-opt').forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.ordenar-opt').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      estado.ordenacao = opt.dataset.ord;
      dropOrdenar.classList.remove('active');
      renderGrid();
    });
  });

  document.getElementById('cat-search')?.addEventListener('input', event => {
    estado.busca = event.currentTarget.value.trim().toLocaleLowerCase('pt-BR');
    renderGrid();
  });

  /* Delegação de eventos de clique nos cards do grid */
  const catGrid = document.getElementById('cat-grid');
  if (catGrid) {
    catGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const prodId = btn.dataset.prodId;
      if (!prodId) return;

      if (action === 'modelagem') {
        const novaMod = btn.dataset.modelagem;
        trocarModelagemCard(prodId, novaMod);
      } else if (action === 'tamanho') {
        const tam = btn.dataset.tamanho;
        selecionarTamanhoCard(prodId, tam);
      } else if (action === 'cor') {
        const cor = btn.dataset.cor;
        selecionarCorCard(prodId, cor);
      } else if (action === 'guia-medidas') {
        const cardState = estadoCards[prodId];
        abrirGuiaMedidas(cardState?.modelagem || 'classico');
      } else if (action === 'adicionar') {
        adicionarAoPedidoCard(prodId);
      }
    });
  }

  /* Listeners do Modal Guia de Medidas */
  document.getElementById('btn-medidas-close')?.addEventListener('click', fecharGuiaMedidas);
  document.getElementById('medidas-overlay')?.addEventListener('click', fecharGuiaMedidas);

  document.querySelectorAll('.medidas-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const mod = tab.dataset.modelagem;
      renderTabelaMedidas(mod);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      fecharGuiaMedidas();
    }
  });
}

/* ── Toggle drawer de filtros ──────────────────────────────── */
function toggleFiltrosDrawer(show) {
  document.getElementById('filtros-drawer')?.classList.toggle('active', show);
  document.getElementById('filtros-overlay')?.classList.toggle('active', show);
  document.body.style.overflow = show ? 'hidden' : '';
}

/* ── Limpar todos os filtros ───────────────────────────────── */
function limparFiltros() {
  estado.categoria          = 'todos';
  estado.estilo             = 'todos';
  estado.tipoPersonalizacao = 'todos';
  estado.filtrosAtivos      = 0;

  document.querySelectorAll('input[name="f-categoria"]').forEach(r => { r.checked = r.value === 'todos'; });
  document.querySelectorAll('input[name="f-estilo"]').forEach(r    => { r.checked = r.value === 'todos'; });
  document.querySelectorAll('input[name="f-tipo"]').forEach(r      => { r.checked = r.value === 'todos'; });
  document.querySelectorAll('.cat-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === 'todos'));

  atualizarBannerCategoria('todos', true);
  atualizarContadorFiltros();
  renderGrid();
}

/* ── Contar filtros ativos ─────────────────────────────────── */
function contarFiltros() {
  let n = 0;
  if (estado.estilo             !== 'todos') n++;
  if (estado.tipoPersonalizacao !== 'todos') n++;
  estado.filtrosAtivos = n;
  atualizarContadorFiltros();
}

function atualizarContadorFiltros() {
  const span = document.getElementById('filtrar-count');
  if (!span) return;
  if (estado.filtrosAtivos > 0) {
    span.textContent = estado.filtrosAtivos;
    span.style.display = 'inline-flex';
  } else {
    span.style.display = 'none';
  }
}

/* ── Filtrar produtos ──────────────────────────────────────── */
function filtrarProdutos() {
  return PRODUTOS.filter(p => {
    if (estado.categoria          !== 'todos' && p.categoria          !== estado.categoria)          return false;
    if (estado.estilo             !== 'todos' && p.estilo             !== estado.estilo)             return false;
    if (estado.tipoPersonalizacao !== 'todos' && p.tipoPersonalizacao !== estado.tipoPersonalizacao) return false;
    if (estado.busca && !p.nome.toLocaleLowerCase('pt-BR').includes(estado.busca)) return false;
    return true;
  });
}

/* ── Ordenar produtos ──────────────────────────────────────── */
function ordenarProdutos(lista) {
  const copia = [...lista];
  switch (estado.ordenacao) {
    case 'preco-asc':  return copia.sort((a, b) => a.precoBase - b.precoBase);
    case 'preco-desc': return copia.sort((a, b) => b.precoBase - a.precoBase);
    case 'nome':       return copia.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    case 'destaque':
    default:           return copia.sort((a, b) => (b.destaque ? 1 : 0) - (a.destaque ? 1 : 0));
  }
}

/* ── Calcular preço do lote ────────────────────────────────── */
function calcularPrecoLote(produto, qtd = 10) {
  if (produto.tipoPersonalizacao === 'personalizavel') {
    return (produto.precoBase + 60 / qtd) * qtd;
  }
  return produto.precoBase * qtd;
}

/* ── Estado por card ───────────────────────────────────────── */
function garantirEstadoCard(produto) {
  if (!estadoCards[produto.id]) {
    estadoCards[produto.id] = {
      produto: produto.nome,
      produtoId: produto.id,
      categoria: produto.categoria,
      modelagem: 'classico', // Padrão "Clássico"
      tamanho: null,
      cor: Array.isArray(produto.cores) && produto.cores.length > 0 ? produto.cores[0] : null,
      quantidade: 1,
      precoBase: produto.precoBase
    };
  }
  return estadoCards[produto.id];
}

/* ── Troca de Modelagem: mantém tamanho se existir na nova, senão limpa */
function trocarModelagemCard(produtoId, novaModelagem) {
  const cardState = estadoCards[produtoId];
  if (!cardState) return;

  if (cardState.modelagem === novaModelagem) return;

  cardState.modelagem = novaModelagem;
  const tamanhosValidos = CONFIG_MODELAGENS[novaModelagem]?.tamanhos || [];

  // Se o tamanho escolhido existir na nova modelagem, mantém; senão, limpa.
  if (cardState.tamanho && !tamanhosValidos.includes(cardState.tamanho)) {
    cardState.tamanho = null;
  }

  // Remove alerta de tamanho se estiver visível
  const cardEl = document.querySelector(`.cat-card[data-id="${produtoId}"]`);
  const alertaEl = cardEl?.querySelector('.cat-card-alerta');
  if (alertaEl) alertaEl.classList.remove('visivel');

  atualizarCardUI(produtoId);
}

/* ── Seleção de Tamanho ────────────────────────────────────── */
function selecionarTamanhoCard(produtoId, tamanho) {
  const cardState = estadoCards[produtoId];
  if (!cardState) return;

  // Um selecionado por vez; clicar no mesmo desseleciona
  cardState.tamanho = (cardState.tamanho === tamanho) ? null : tamanho;

  const cardEl = document.querySelector(`.cat-card[data-id="${produtoId}"]`);
  const alertaEl = cardEl?.querySelector('.cat-card-alerta');
  if (alertaEl) alertaEl.classList.remove('visivel');

  atualizarCardUI(produtoId);
}

/* ── Seleção de Cor ────────────────────────────────────────── */
function selecionarCorCard(produtoId, cor) {
  const cardState = estadoCards[produtoId];
  if (!cardState) return;
  cardState.cor = cor;
  atualizarCardUI(produtoId);
}

/* ── Atualiza apenas os elementos interativos do card ──────── */
function atualizarCardUI(produtoId) {
  const produto = PRODUTOS.find(p => p.id === produtoId);
  if (!produto || produto.categoria !== 'camisa') return;

  const cardEl = document.querySelector(`.cat-card[data-id="${produtoId}"]`);
  if (!cardEl) return;

  const cardState = garantirEstadoCard(produto);
  const modelagemAtual = cardState.modelagem || 'classico';
  const configMod = CONFIG_MODELAGENS[modelagemAtual] || CONFIG_MODELAGENS.classico;

  // Atualizar botões de modelagem
  cardEl.querySelectorAll('.cat-modelagem-btn').forEach(btn => {
    const isAct = btn.dataset.modelagem === modelagemAtual;
    btn.classList.toggle('active', isAct);
    btn.setAttribute('aria-pressed', isAct ? 'true' : 'false');
  });

  // Atualizar lista de tamanhos
  const tamanhosListEl = cardEl.querySelector('.cat-tamanhos-list');
  if (tamanhosListEl) {
    tamanhosListEl.innerHTML = configMod.tamanhos.map(tam => {
      const isAct = cardState.tamanho === tam;
      return `
        <button
          type="button"
          class="cat-tamanho-btn ${isAct ? 'active' : ''}"
          data-action="tamanho"
          data-prod-id="${escapeHtml(produto.id)}"
          data-tamanho="${escapeHtml(tam)}"
          aria-pressed="${isAct ? 'true' : 'false'}"
          title="Tamanho ${escapeHtml(tam)}"
        >
          ${escapeHtml(tam)}
        </button>
      `;
    }).join('');
  }

  // Atualizar cores
  cardEl.querySelectorAll('.cat-cor').forEach(btn => {
    const isAct = btn.dataset.cor === cardState.cor;
    btn.classList.toggle('active', isAct);
    btn.setAttribute('aria-pressed', isAct ? 'true' : 'false');
  });
}

/* ── Adicionar ao Pedido com Validação ─────────────────────── */
function adicionarAoPedidoCard(produtoId) {
  const produto = PRODUTOS.find(p => p.id === produtoId);
  const cardState = estadoCards[produtoId];
  if (!produto || !cardState) return;

  const cardEl = document.querySelector(`.cat-card[data-id="${produtoId}"]`);
  const alertaEl = cardEl?.querySelector('.cat-card-alerta');

  // Validação: Só permitir adicionar depois de escolher modelagem e tamanho
  if (produto.categoria === 'camisa') {
    if (!cardState.modelagem || !cardState.tamanho) {
      if (alertaEl) {
        alertaEl.textContent = 'Escolha a modelagem e o tamanho antes de adicionar ao pedido.';
        alertaEl.classList.add('visivel');
      }
      return;
    }
  }

  if (alertaEl) alertaEl.classList.remove('visivel');

  const modelagemNome = CONFIG_MODELAGENS[cardState.modelagem]?.nome || 'Clássico';
  const tamanhoFormatado = cardState.tamanho ? `${cardState.tamanho} (${modelagemNome})` : 'Padrão';

  /* Objeto de estado pronto para envio ao WhatsApp ou Checkout */
  const pedidoItem = {
    produto: produto.nome,
    produtoId: produto.id,
    modelagem: modelagemNome,
    tamanho: cardState.tamanho,
    cor: cardState.cor || 'Padrão',
    quantidade: cardState.quantidade || 1,
    precoUnitario: produto.precoBase,
    dataRegistro: new Date().toISOString()
  };

  cardState.ultimoAdicionado = pedidoItem;

  // Integração com o carrinho existente do site
  try {
    cart.addItem(produto, 1, {
      tamanho: tamanhoFormatado,
      cor: cardState.cor || 'Padrão',
      modelagem: modelagemNome
    });
  } catch (err) {
    console.warn('Aviso ao sincronizar com carrinho:', err);
  }

  // Feedback visual de sucesso no botão
  const btnAdd = cardEl?.querySelector('.cat-btn-adicionar');
  if (btnAdd) {
    const originalHtml = btnAdd.innerHTML;
    btnAdd.classList.add('adicionado');
    btnAdd.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      Adicionado!
    `;
    setTimeout(() => {
      btnAdd.classList.remove('adicionado');
      btnAdd.innerHTML = originalHtml;
    }, 1800);
  }
}

/* ── Modal Guia de Medidas ─────────────────────────────────── */
function abrirGuiaMedidas(modelagemInicial = 'classico') {
  const modal = document.getElementById('medidas-modal');
  const overlay = document.getElementById('medidas-overlay');
  if (!modal || !overlay) return;

  renderTabelaMedidas(modelagemInicial);

  overlay.classList.add('active');
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  setTimeout(() => {
    document.getElementById('btn-medidas-close')?.focus();
  }, 100);
}

function fecharGuiaMedidas() {
  const modal = document.getElementById('medidas-modal');
  const overlay = document.getElementById('medidas-overlay');
  if (!modal || !overlay) return;

  overlay.classList.remove('active');
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

function renderTabelaMedidas(modelagemKey) {
  const key = modelagemKey === 'babyLook' ? 'babyLook' : 'classico';
  const dados = TABELA_MEDIDAS[key];
  if (!dados) return;

  // Atualizar abas do modal
  document.querySelectorAll('.medidas-tab').forEach(tab => {
    const isActive = tab.dataset.modelagem === key;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  // Atualizar linhas da tabela
  const tbody = document.getElementById('medidas-table-body');
  if (tbody) {
    tbody.innerHTML = dados.linhas.map(l => `
      <tr>
        <td class="col-tamanho">${escapeHtml(l.tamanho)}</td>
        <td>${escapeHtml(l.largura)}</td>
        <td>${escapeHtml(l.comprimento)}</td>
      </tr>
    `).join('');
  }
}

/* ── Renderizar bolinhas de cor ────────────────────────────── */
function renderCoresHTML(cores, produtoId) {
  if (!cores || cores.length === 0) return '';
  const cardState = estadoCards[produtoId];
  const corAtiva = cardState ? cardState.cor : cores[0];

  const bolinhas = cores.map(c => {
    const hex   = COR_HEX[c] || '#cccccc';
    const borda = c === 'branco' ? '1.5px solid #ccc' : '1.5px solid rgba(0,0,0,0.12)';
    const isActive = corAtiva === c;
    return `
      <button
        type="button"
        class="cat-cor ${isActive ? 'active' : ''}"
        style="background:${hex};border:${borda}"
        data-action="cor"
        data-prod-id="${escapeHtml(produtoId)}"
        data-cor="${escapeHtml(c)}"
        title="Cor: ${escapeHtml(c)}"
        aria-label="Cor ${escapeHtml(c)}"
        aria-pressed="${isActive ? 'true' : 'false'}"
      ></button>
    `;
  }).join('');

  return `<div class="cat-cores" role="group" aria-label="Selecione a cor">${bolinhas}</div>`;
}

/* ── Renderizar estrelas ───────────────────────────────────── */
function renderStars(avaliacao) {
  const filled = Math.min(5, Math.max(0, Math.round(avaliacao || 5)));
  const count = arguments[1] || 0;
  return `<div class="cat-stars" aria-label="Avaliação ${filled} de 5">${'\u2605'.repeat(filled)}${'\u2606'.repeat(5 - filled)}${count ? `<span class="cat-rating-count">(${count})</span>` : ''}</div>`;
}

/* ── Renderizar card ───────────────────────────────────────── */
function renderCard(produto) {
  const precoLote = calcularPrecoLote(produto, 10);
  const cores = (produto.cores || []).map(cor => `<span class="cat-cor" style="--cat-cor:${COR_HEX[String(cor).toLowerCase()] || '#aaa'}" title="${escapeHtml(cor)}" aria-label="${escapeHtml(cor)}"></span>`).join('');
  return `
    <article class="cat-card" data-id="${escapeHtml(produto.id)}" tabindex="0" role="link" aria-label="Ver detalhes de ${escapeHtml(produto.nome)}">
      <div class="cat-img-box">${produto.destaque ? '<span class="cat-badge-destaque">Destaque</span>' : ''}<img src="${escapeHtml(produto.imagem)}" alt="${escapeHtml(produto.nome)}" loading="lazy" decoding="async"></div>
      <div class="cat-info">${renderStars(produto.avaliacao, produto.avaliacoesCount || produto.quantidadeAvaliacoes)}<h3 class="cat-nome">${escapeHtml(produto.nome)}</h3>
        <p class="cat-preco">${formatBRL(produto.precoBase)}<span class="cat-preco-un"> / un.</span></p>
        <div class="cat-lote-row"><p class="cat-preco-lote">Lote de 10 un.: ${formatBRL(precoLote)}</p><span class="cat-min-tag">Min. 10 peças</span></div>
        ${cores ? `<div class="cat-cores" aria-label="Cores disponíveis">${cores}</div>` : ''}
      </div>
    </article>`;
}
/* ── Renderizar grid completo ──────────────────────────────── */
function renderGrid() {
  const grid    = document.getElementById('cat-grid');
  const countEl = document.getElementById('cat-count');
  const emptyEl = document.getElementById('cat-empty');
  if (!grid) return;

  const filtrados = filtrarProdutos();
  const ordenados = ordenarProdutos(filtrados);

  if (countEl) {
    countEl.textContent = `${ordenados.length} produto${ordenados.length !== 1 ? 's' : ''}`;
  }

  if (ordenados.length === 0) {
    grid.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'flex';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';
  grid.innerHTML = ordenados.map(renderCard).join('');
  grid.querySelectorAll('.cat-card').forEach(card => {
    const abrir = () => { window.location.href = `produto.html?id=${encodeURIComponent(card.dataset.id)}`; };
    card.addEventListener('click', abrir);
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); abrir(); }
    });
  });
}

/* ── Exposição Global Segura ───────────────────────────────── */
if (typeof window !== 'undefined') {
  window.CONFIG_MODELAGENS = CONFIG_MODELAGENS;
  window.TABELA_MEDIDAS = TABELA_MEDIDAS;
  window.obterEstadoPedido = obterEstadoPedido;
  window.catalogoEstadoCards = estadoCards;
}
