/* pedido-lote.js - Script de Montagem de Pedido em Lote */
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
    console.warn("Usando produtos locais no pedido em lote:", err);
  }

  initPedidoLote();
});

function initPedidoLote() {
  const tbody = document.getElementById("lote-linhas-body");
  const selectProduto = document.getElementById("lote-produto-select");
  const btnAddLinha = document.getElementById("btn-add-linha-lote");
  const btnAddCarrinho = document.getElementById("btn-adicionar-lote-carrinho");

  const totalPecasEl = document.getElementById("lote-total-pecas");
  const precoUnitarioEl = document.getElementById("lote-preco-unitario");
  const valorTotalEl = document.getElementById("lote-valor-total");

  if (!tbody || !selectProduto) return;

  // Estado das linhas do lote
  let linhas = [
    { tamanho: "P", cor: "Branco", quantidade: 10 },
    { tamanho: "M", cor: "Branco", quantidade: 20 },
    { tamanho: "G", cor: "Branco", quantidade: 15 }
  ];

  function calcularERenderizar() {
    const prodId = selectProduto.value;
    const produto = PRODUTOS.find(p => p.id === prodId) || PRODUTOS[0];

    const totalPecas = linhas.reduce((acc, row) => acc + (parseInt(row.quantidade, 10) || 0), 0);
    const precoUnitario = calcularPrecoUnitario(produto, totalPecas);
    const valorTotal = totalPecas * precoUnitario;

    if (totalPecasEl) totalPecasEl.textContent = totalPecas;
    if (precoUnitarioEl) precoUnitarioEl.textContent = formatBRL(precoUnitario);
    if (valorTotalEl) valorTotalEl.textContent = formatBRL(valorTotal);

    tbody.innerHTML = linhas.map((linha, index) => `
      <tr>
        <td>
          <select class="form-input row-tamanho" data-index="${index}">
            ${["P", "M", "G", "GG", "EXG"].map(t => `<option value="${t}" ${t === linha.tamanho ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </td>
        <td>
          <input type="text" class="form-input row-cor" data-index="${index}" value="${escapeHtml(linha.cor)}" placeholder="Cor">
        </td>
        <td>
          <input type="number" class="form-input row-qtd" data-index="${index}" value="${linha.quantidade}" min="1">
        </td>
        <td>
          <button class="btn btn-sm btn-perigo btn-remove-row" data-index="${index}">&times; Remover</button>
        </td>
      </tr>
    `).join('');

    // Event listeners da tabela
    tbody.querySelectorAll(".row-tamanho").forEach(el => {
      el.addEventListener("change", (e) => {
        const idx = e.target.getAttribute("data-index");
        linhas[idx].tamanho = e.target.value;
        calcularERenderizar();
      });
    });

    tbody.querySelectorAll(".row-cor").forEach(el => {
      el.addEventListener("input", (e) => {
        const idx = e.target.getAttribute("data-index");
        linhas[idx].cor = e.target.value;
      });
    });

    tbody.querySelectorAll(".row-qtd").forEach(el => {
      el.addEventListener("input", (e) => {
        const idx = e.target.getAttribute("data-index");
        const val = parseInt(e.target.value, 10) || 0;
        linhas[idx].quantidade = val;
        calcularERenderizar();
      });
    });

    tbody.querySelectorAll(".btn-remove-row").forEach(el => {
      el.addEventListener("click", (e) => {
        const idx = parseInt(e.target.getAttribute("data-index"), 10);
        linhas.splice(idx, 1);
        calcularERenderizar();
      });
    });
  }

  if (selectProduto) {
    selectProduto.addEventListener("change", calcularERenderizar);
  }

  if (btnAddLinha) {
    btnAddLinha.addEventListener("click", () => {
      linhas.push({ tamanho: "M", cor: "Branco", quantidade: 10 });
      calcularERenderizar();
    });
  }

  if (btnAddCarrinho) {
    btnAddCarrinho.addEventListener("click", () => {
      const prodId = selectProduto.value;
      const produto = PRODUTOS.find(p => p.id === prodId) || PRODUTOS[0];
      const totalPecas = linhas.reduce((acc, row) => acc + (parseInt(row.quantidade, 10) || 0), 0);
      const precoUnitario = calcularPrecoUnitario(produto, totalPecas);

      if (totalPecas <= 0) {
        cart.showToast("Adicione pelo menos 1 peça na grade do lote.", "erro");
        return;
      }

      linhas.forEach(row => {
        if (row.quantidade > 0) {
          cart.addItem(produto, row.quantidade, {
            tamanho: row.tamanho,
            cor: row.cor,
            precoUnitarioCalculado: precoUnitario
          });
        }
      });

      cart.showToast(`Lote com ${totalPecas} peças adicionado ao carrinho!`, "sucesso");
    });
  }

  calcularERenderizar();
}
