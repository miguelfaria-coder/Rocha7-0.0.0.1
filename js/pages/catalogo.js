/* catalogo.js - Script da Página do Catálogo com Filtros Dinâmicos */
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { carregarProdutos, PRODUTOS as PRODUTOS_LOCAL } from '../data/products.js';
import { escapeHtml, formatBRL } from '../utils.js';

let PRODUTOS = PRODUTOS_LOCAL;

document.addEventListener("DOMContentLoaded", async () => {
  renderHeader();
  renderFooter();

  try {
    PRODUTOS = await carregarProdutos();
  } catch (err) {
    console.warn("Usando produtos padrão no catálogo:", err);
  }

  initCatalogo();
});

function initCatalogo() {
  const params = new URLSearchParams(window.location.search);
  const initialCategoria = params.get("categoria") || "todos";
  const initialBusca = params.get("busca") || "";

  let estadoFiltros = {
    categoria: initialCategoria,
    estilo: "todos",
    tipoPersonalizacao: "todos",
    busca: initialBusca
  };

  // Definir radio inicial de categoria se houver na URL
  const radioCategoria = document.querySelector(`input[name="categoria"][value="${initialCategoria}"]`);
  if (radioCategoria) {
    radioCategoria.checked = true;
  }

  const buscaInput = document.getElementById("busca-input");
  if (buscaInput && initialBusca) {
    buscaInput.value = initialBusca;
  }

  // Event Listeners Filtros Sidebar
  document.querySelectorAll('input[name="categoria"]').forEach(r => {
    r.addEventListener("change", (e) => {
      estadoFiltros.categoria = e.target.value;
      atualizarView();
    });
  });

  document.querySelectorAll('input[name="estilo"]').forEach(r => {
    r.addEventListener("change", (e) => {
      estadoFiltros.estilo = e.target.value;
      atualizarView();
    });
  });

  document.querySelectorAll('input[name="tipoPersonalizacao"]').forEach(r => {
    r.addEventListener("change", (e) => {
      estadoFiltros.tipoPersonalizacao = e.target.value;
      atualizarView();
    });
  });

  if (buscaInput) {
    buscaInput.addEventListener("input", (e) => {
      estadoFiltros.busca = e.target.value.toLowerCase().trim();
      atualizarView();
    });
  }

  // Limpar Filtros Button
  const btnLimpar = document.getElementById("btn-limpar-filtros");
  if (btnLimpar) {
    btnLimpar.addEventListener("click", () => {
      estadoFiltros = {
        categoria: "todos",
        estilo: "todos",
        tipoPersonalizacao: "todos",
        busca: ""
      };
      document.querySelectorAll('input[type="radio"]').forEach(r => {
        if (r.value === "todos") r.checked = true;
      });
      if (buscaInput) buscaInput.value = "";
      atualizarView();
    });
  }

  // Sidebar Mobile Toggle
  const mobileBtn = document.getElementById("filtros-mobile-toggle");
  const sidebar = document.getElementById("filtros-sidebar");
  const overlay = document.getElementById("filtros-overlay");

  if (mobileBtn && sidebar && overlay) {
    const toggleSidebar = (show) => {
      if (show) {
        sidebar.classList.add("active");
        overlay.classList.add("active");
      } else {
        sidebar.classList.remove("active");
        overlay.classList.remove("active");
      }
    };
    mobileBtn.addEventListener("click", () => toggleSidebar(true));
    overlay.addEventListener("click", () => toggleSidebar(false));
  }

  function atualizarView() {
    const produtosFiltrados = PRODUTOS.filter(p => {
      if (estadoFiltros.categoria !== "todos" && p.categoria !== estadoFiltros.categoria) return false;
      if (estadoFiltros.estilo !== "todos" && p.estilo !== estadoFiltros.estilo) return false;
      if (estadoFiltros.tipoPersonalizacao !== "todos" && p.tipoPersonalizacao !== estadoFiltros.tipoPersonalizacao) return false;
      if (estadoFiltros.busca && !p.nome.toLowerCase().includes(estadoFiltros.busca) && !p.descricao.toLowerCase().includes(estadoFiltros.busca)) return false;
      return true;
    });

    renderTagsAtivas(estadoFiltros);
    renderProdutosGrid(produtosFiltrados);
  }

  // Primeira renderização
  atualizarView();
}

function renderTagsAtivas(filtros) {
  const container = document.getElementById("filtros-ativos-container");
  if (!container) return;

  let html = "";
  if (filtros.categoria !== "todos") {
    html += `<div class="filtro-tag-ativa">Categoria: ${escapeHtml(filtros.categoria)}</div>`;
  }
  if (filtros.estilo !== "todos") {
    html += `<div class="filtro-tag-ativa">Estilo: ${escapeHtml(filtros.estilo)}</div>`;
  }
  if (filtros.tipoPersonalizacao !== "todos") {
    html += `<div class="filtro-tag-ativa">Tipo: ${escapeHtml(filtros.tipoPersonalizacao)}</div>`;
  }
  if (filtros.busca) {
    html += `<div class="filtro-tag-ativa">Busca: "${escapeHtml(filtros.busca)}"</div>`;
  }

  container.innerHTML = html;
}

function renderProdutosGrid(produtos) {
  const grid = document.getElementById("produtos-grid-container");
  const countEl = document.getElementById("catalogo-resultados-count");
  if (!grid) return;

  if (countEl) {
    countEl.innerHTML = `Exibindo <strong>${produtos.length}</strong> produtos`;
  }

  if (produtos.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 48px 0; color: var(--cor-texto-sec);">
        <h3>Nenhum produto encontrado com os filtros selecionados.</h3>
        <p>Tente ajustar a busca ou limpar os filtros para explorar todo o catálogo.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = produtos.map(produto => `
    <div class="produto-card">
      <div class="produto-img-wrapper">
        ${produto.destaque ? '<span class="badge badge-destaque produto-badge">Destaque</span>' : ''}
        <img src="${escapeHtml(produto.imagem)}" alt="${escapeHtml(produto.nome)}" loading="lazy" decoding="async">
      </div>
      <div class="produto-info">
        <span class="produto-categoria">${escapeHtml(produto.categoria)} - ${escapeHtml(produto.estilo)}</span>
        <h3 class="produto-titulo">
          <a href="produto.html?id=${encodeURIComponent(produto.id)}">${escapeHtml(produto.nome)}</a>
        </h3>
        <div class="stars">★★★★★</div>
        <div class="produto-preco-wrapper">
          <div>
            <span class="preco">${formatBRL(produto.precoBase)}</span>
          </div>
          <a href="produto.html?id=${encodeURIComponent(produto.id)}" class="btn btn-sm btn-ghost">
            Ver Detalhes →
          </a>
        </div>
      </div>
    </div>
  `).join('');
}
