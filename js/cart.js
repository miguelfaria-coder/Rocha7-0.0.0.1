/* cart.js - Gerenciador do Carrinho de Compras */
import { escapeHtml } from "./utils.js";

const CART_STORAGE_KEY = "rocha7_cart_items_v1";

function itemBabyLookRemovido(item) {
  const normalizar = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/babylook/g, 'baby look').replace(/[-_]+/g, ' ').trim();
  const id = String(item?.id || item?.produto_id || '');
  return ['prod-6', 'prod-7'].includes(id) ||
    normalizar(item?.nome || item?.nome_produto).includes('baby look') ||
    normalizar(item?.categoria || item?.categoria_id).includes('baby look') ||
    normalizar(item?.estilo) === 'baby look';
}

class CartManager {
  constructor() {
    this.items = this.loadCart();
  }

  loadCart() {
    try {
      const data = localStorage.getItem(CART_STORAGE_KEY);
      const stored = data ? JSON.parse(data) : [];
      if (!Array.isArray(stored)) return [];
      const current = stored.filter(item => item && !itemBabyLookRemovido(item));
      if (current.length !== stored.length) localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(current));
      return current;
    } catch (e) {
      console.error("Erro ao carregar carrinho:", e);
      return [];
    }
  }

  saveCart() {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(this.items));
      window.dispatchEvent(new CustomEvent("cart-updated", { detail: this.getSummary() }));
    } catch (e) {
      console.error("Erro ao salvar carrinho:", e);
    }
  }

  addItem(produto, quantidade = 1, opcoes = {}) {
    const key = `${produto.id}_${opcoes.tamanho || 'M'}_${opcoes.cor || 'padrao'}_${opcoes.modelagem || 'classico'}_${opcoes.customDesignId || 'base'}`;
    const index = this.items.findIndex(item => item.key === key);

    const precoUnitario = opcoes.precoUnitarioCalculado !== undefined 
      ? opcoes.precoUnitarioCalculado 
      : produto.precoBase;

    if (index > -1) {
      this.items[index].quantidade += quantidade;
      this.items[index].precoUnitario = precoUnitario;
    } else {
      this.items.push({
        key,
        id: produto.id,
        nome: produto.nome,
        imagem: produto.imagem,
        tamanho: opcoes.tamanho || 'M',
        cor: opcoes.cor || 'Padrão',
        modelagem: opcoes.modelagem || 'classico',
        quantidade: quantidade,
        precoUnitario: precoUnitario,
        customDesign: opcoes.customDesign || null
      });
    }

    this.saveCart();
    this.showToast(`"${produto.nome}" adicionado ao carrinho!`, "sucesso");
  }

  removeItem(key) {
    this.items = this.items.filter(item => item.key !== key);
    this.saveCart();
    this.showToast("Item removido do carrinho.", "info");
  }

  updateQuantity(key, novaQuantidade) {
    const qtd = parseInt(novaQuantidade, 10);
    if (isNaN(qtd) || qtd <= 0) {
      this.removeItem(key);
      return;
    }
    const item = this.items.find(i => i.key === key);
    if (item) {
      item.quantidade = qtd;
      this.saveCart();
    }
  }

  clearCart() {
    this.items = [];
    this.saveCart();
  }

  getSummary() {
    const totalItens = this.items.reduce((acc, item) => acc + (parseInt(item.quantidade, 10) || 0), 0);
    const valorTotalRaw = this.items.reduce((acc, item) => acc + ((parseInt(item.quantidade, 10) || 0) * (Number(item.precoUnitario) || 0)), 0);
    const valorTotal = Math.round(valorTotalRaw * 100) / 100;
    return {
      items: this.items,
      totalItens,
      valorTotal
    };
  }

  showToast(mensagem, tipo = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${tipo}`;
    toast.innerHTML = `<span>${escapeHtml(mensagem)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

export const cart = new CartManager();

if (typeof window !== 'undefined') {
  window.cart = cart;
}
