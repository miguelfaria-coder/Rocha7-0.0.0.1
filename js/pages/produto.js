/* produto.js - Script da Página Detalhes do Produto */
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { carregarProdutos, PRODUTOS as PRODUTOS_LOCAL, calcularPrecoUnitario } from '../data/products.js';
import { cart } from '../cart.js';
import { escapeHtml, formatBRL } from '../utils.js';

let PRODUTOS = PRODUTOS_LOCAL;

document.addEventListener("DOMContentLoaded", async () => {
  renderHeader();
  renderFooter();

  try {
    PRODUTOS = await carregarProdutos();
  } catch (err) {
    console.warn("Usando produtos locais na página de produto:", err);
  }

  initProdutoDetalhe();
});

function initProdutoDetalhe() {
  const container = document.getElementById("produto-container");
  const breadcrumbNome = document.getElementById("breadcrumb-produto-nome");
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const prodId = params.get("id") || "prod-1";
  const produto = PRODUTOS.find(p => p.id === prodId) || PRODUTOS[0];

  if (!produto) return;

  if (breadcrumbNome) {
    breadcrumbNome.textContent = produto.nome;
  }

  let tamanhoSelecionado = "M";
  let corSelecionada = produto.cores && produto.cores.length > 0 ? produto.cores[0] : "branco";
  let quantidade = 1;

  function renderView() {
    const precoUnitario = calcularPrecoUnitario(produto, quantidade);
    const precoTotal = precoUnitario * quantidade;

    container.innerHTML = `
      <div class="produto-detalhe-grid">
        <div class="produto-galeria">
          <img src="${escapeHtml(produto.imagem)}" alt="${escapeHtml(produto.nome)}" class="produto-imagem-principal" decoding="async">
        </div>

        <div class="produto-info-detalhe">
          <span class="badge badge-destaque" style="align-self: flex-start;">${escapeHtml(produto.categoria.toUpperCase())} - ${escapeHtml(produto.tipoPersonalizacao.toUpperCase())}</span>
          <h1 class="produto-titulo-detalhe">${escapeHtml(produto.nome)}</h1>
          <div class="stars" style="font-size: 18px;">★★★★★ (5.0 de 5)</div>

          <div style="background: var(--cor-superficie); padding: 16px; border-radius: 8px; border: 1px solid var(--cor-borda);">
            <div class="resumo-linha">
              <span>Preço por unidade (${quantidade}x):</span>
              <strong class="preco" style="font-size: 24px;">${formatBRL(precoUnitario)}</strong>
            </div>
            ${produto.tipoPersonalizacao === 'personalizavel' ? 
              '<p class="texto-xs texto-sec" style="margin-top:6px; color: var(--cor-primaria);">* Custo de estampa diluído automaticamente com o aumento da quantidade!</p>' : ''}
          </div>

          <p class="texto-sec">${escapeHtml(produto.descricao)}</p>

          <!-- SELEÇÃO DE TAMANHO -->
          <div class="produto-opcoes-grupo">
            <label class="form-label">Tamanho:</label>
            <div class="tamanhos-selector">
              ${["P", "M", "G", "GG", "EXG"].map(tam => `
                <button class="btn-tamanho ${tam === tamanhoSelecionado ? 'selecionado' : ''}" data-tamanho="${tam}">${tam}</button>
              `).join('')}
            </div>
          </div>

          <!-- SELEÇÃO DE COR -->
          <div class="produto-opcoes-grupo">
            <label class="form-label">Cor:</label>
            <div class="color-options">
              ${(produto.cores || []).map(cor => `
                <div class="color-option ${cor === corSelecionada ? 'selecionado' : ''}" data-cor="${escapeHtml(cor)}" title="${escapeHtml(cor)}"></div>
              `).join('')}
            </div>
          </div>

          <!-- QUANTIDADE & CTA -->
          <div class="form-group">
            <label class="form-label">Quantidade de Peças:</label>
            <div style="display:flex; gap:16px; align-items:center;">
              <input type="number" id="input-qtd-detalhe" class="form-input" value="${quantidade}" min="1" style="max-width: 100px;">
              <button id="btn-add-carrinho-detalhe" class="btn btn-primario btn-lg" style="flex:1;">
                Adicionar ao Carrinho (${formatBRL(precoTotal)})
              </button>
            </div>
          </div>

          ${produto.tipoPersonalizacao === 'personalizavel' ? `
            <div style="margin-top: 12px; padding-top: 16px; border-top: 1px solid var(--cor-borda);">
              <a href="editor.html?id=${encodeURIComponent(produto.id)}" class="btn btn-secundario btn-full">
                Personalizar este produto no Editor 3D →
              </a>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    // Listeners Tamanho
    container.querySelectorAll(".btn-tamanho").forEach(btn => {
      btn.addEventListener("click", (e) => {
        tamanhoSelecionado = e.currentTarget.getAttribute("data-tamanho");
        renderView();
      });
    });

    // Listeners Cor
    container.querySelectorAll(".color-option").forEach(btn => {
      btn.addEventListener("click", (e) => {
        corSelecionada = e.currentTarget.getAttribute("data-cor");
        renderView();
      });
    });

    // Listener Quantidade
    const inputQtd = container.querySelector("#input-qtd-detalhe");
    if (inputQtd) {
      inputQtd.addEventListener("input", (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val >= 1) {
          quantidade = val;
          renderView();
        }
      });
    }

    // Add to Cart CTA
    const btnAdd = container.querySelector("#btn-add-carrinho-detalhe");
    if (btnAdd) {
      btnAdd.addEventListener("click", () => {
        cart.addItem(produto, quantidade, {
          tamanho: tamanhoSelecionado,
          cor: corSelecionada,
          precoUnitarioCalculado: precoUnitario
        });
      });
    }
  }

  renderView();
}
