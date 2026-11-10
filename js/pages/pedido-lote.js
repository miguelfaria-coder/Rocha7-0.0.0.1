/* Montagem de pedido em lote: catálogo, cálculo e persistência locais. */
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { carregarProdutos, PRODUTOS as PRODUTOS_LOCAL, calcularPrecoUnitario } from '../data/products.js';
import { cart } from '../cart.js';
import { escapeHtml, formatBRL } from '../utils.js';

const STORAGE_KEY = 'rocha7_pedido_lote_v1';
const TAMANHOS = ['PP', 'P', 'M', 'G', 'GG', 'XP', 'XM', 'XG', 'G1', 'G2', 'G3'];
const MODELAGENS = [
  { id: 'classico', nome: 'Clássico' },
  { id: 'babyLook', nome: 'Baby Look' }
];
const CORES_HEX = {
  branco: '#ffffff', preto: '#222222', cinza: '#888888', 'azul-marinho': '#1a2e5a',
  rosa: '#f4a7b9', vermelho: '#c53535', azul: '#3478b8', verde: '#398451', amarelo: '#f2cf4a'
};
const WHATSAPP_NUMBER = '5511999999999';

let PRODUTOS = PRODUTOS_LOCAL;

document.addEventListener('DOMContentLoaded', async () => {
  renderHeader();
  renderFooter();
  try { PRODUTOS = await carregarProdutos(); }
  catch (error) { console.warn('Usando produtos locais no pedido em lote:', error); }
  iniciarPedidoLote();
});

function lerLoteSalvo() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(saved)) return [];
    const valid = saved.filter(row => row && PRODUTOS.some(product => String(product.id) === String(row.produtoId)));
    if (valid.length !== saved.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
    return valid
      .map(row => ({
        produtoId: String(row.produtoId),
        modelagem: String(row.modelagem || ''),
        cor: String(row.cor || ''),
        tamanho: String(row.tamanho || ''),
        quantidade: Math.max(1, parseInt(row.quantidade, 10) || 1)
      }));
  } catch { return []; }
}

function iniciarPedidoLote() {
  const selectProduto = document.getElementById('lote-produto-select');
  const linhasEl = document.getElementById('lote-linhas-body');
  if (!selectProduto || !linhasEl) return;

  const produtos = [...PRODUTOS].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  let linhas = lerLoteSalvo();
  const builder = { produtoId: produtos[0] ? String(produtos[0].id) : '', modelagem: '', cor: '', tamanho: '', quantidade: 10 };

  selectProduto.innerHTML = produtos.map(product => `<option value="${escapeHtml(product.id)}">${escapeHtml(product.nome)}</option>`).join('');
  selectProduto.value = builder.produtoId;

  function obterProduto(id) { return produtos.find(product => String(product.id) === String(id)); }
  function produtoTemModelagem(product) {
    const category = String(product?.categoria || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return category.includes('camis') || category.includes('camisa') || product?.estilo === 'polo';
  }
  function quantidadeTotal() { return linhas.reduce((sum, row) => sum + row.quantidade, 0); }
  function precoLinha(row, total = quantidadeTotal()) {
    const product = obterProduto(row.produtoId);
    return product ? calcularPrecoUnitario(product, total || 1) : 0;
  }
  function totalLote(total = quantidadeTotal()) {
    return linhas.reduce((sum, row) => sum + row.quantidade * precoLinha(row, total), 0);
  }
  function salvar() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(linhas)); }
    catch (error) { console.warn('Não foi possível salvar o lote neste navegador:', error); }
  }

  function renderBuilder() {
    const product = obterProduto(builder.produtoId);
    const modelagensEl = document.getElementById('lote-modelagens');
    const coresEl = document.getElementById('lote-cores');
    const tamanhosEl = document.getElementById('lote-tamanhos');
    const corNomeEl = document.getElementById('lote-cor-nome');
    const tamanhoNomeEl = document.getElementById('lote-tamanho-nome');
    if (!product) {
      modelagensEl.innerHTML = '';
      coresEl.innerHTML = '<span class="lote-sem-opcoes">Nenhuma cor cadastrada.</span>';
      tamanhosEl.innerHTML = '';
      return;
    }
    const colors = Array.isArray(product.cores) ? product.cores : [];
    const modelagemField = modelagensEl.closest('fieldset');
    const permiteModelagem = produtoTemModelagem(product);
    if (modelagemField) modelagemField.hidden = !permiteModelagem;
    if (!permiteModelagem) builder.modelagem = '';
    if (builder.cor && !colors.includes(builder.cor)) builder.cor = '';
    modelagensEl.innerHTML = permiteModelagem ? MODELAGENS.map(model => `<button type="button" class="lote-option-button ${builder.modelagem === model.id ? 'selected' : ''}" data-builder-model="${model.id}" aria-pressed="${builder.modelagem === model.id}">${model.nome}</button>`).join('') : '';
    coresEl.innerHTML = colors.length ? colors.map(color => {
      const colorName = String(color);
      const normalized = colorName.toLocaleLowerCase('pt-BR');
      return `<button type="button" class="lote-color-button ${builder.cor === colorName ? 'selected' : ''}" data-builder-color="${escapeHtml(colorName)}" style="--lote-swatch:${CORES_HEX[normalized] || '#aaaaaa'}" title="${escapeHtml(colorName)}" aria-label="Selecionar cor ${escapeHtml(colorName)}" aria-pressed="${builder.cor === colorName}"></button>`;
    }).join('') : '<span class="lote-sem-opcoes">Nenhuma cor cadastrada.</span>';
    tamanhosEl.innerHTML = TAMANHOS.map(size => `<button type="button" class="lote-option-button lote-tamanho-button ${builder.tamanho === size ? 'selected' : ''}" data-builder-size="${size}" aria-pressed="${builder.tamanho === size}">${size}</button>`).join('');
    if (corNomeEl) corNomeEl.textContent = builder.cor || 'Selecione';
    if (tamanhoNomeEl) tamanhoNomeEl.textContent = builder.tamanho || 'Selecione';
    document.getElementById('lote-qtd-builder').textContent = builder.quantidade;
  }

  function renderLinhas() {
    const title = document.getElementById('lote-lista-titulo');
    const chip = document.getElementById('lote-total-chip');
    if (!linhas.length) {
      linhasEl.innerHTML = '<div class="lote-empty"><span class="lote-empty-icon" aria-hidden="true">＋</span><p>Seu lote está vazio. Adicione produtos acima.</p></div>';
      if (title) title.textContent = 'Meu lote (0 itens)';
      return;
    }
    if (title) title.textContent = `Meu lote (${linhas.length} ${linhas.length === 1 ? 'item' : 'itens'})`;
    linhasEl.innerHTML = linhas.map((row, index) => {
      const product = obterProduto(row.produtoId);
      if (!product) return '';
      const unitPrice = precoLinha(row);
      const basePrice = Number(product.precoBase) || 0;
      const discount = unitPrice < basePrice && basePrice > 0 ? Math.round((1 - unitPrice / basePrice) * 100) : 0;
      const image = product.imagem || '';
      return `<article class="lote-line">
        <img class="lote-line-image" src="${escapeHtml(image)}" alt="${escapeHtml(product.nome)}" loading="lazy">
        <div class="lote-line-main"><h3 class="lote-line-name">${escapeHtml(product.nome)}</h3>
          <p class="lote-line-meta">Cor: ${escapeHtml(row.cor)} <span aria-hidden="true">|</span> Tamanho: ${escapeHtml(row.tamanho)}${row.modelagem ? ` <span aria-hidden="true">|</span> Modelagem: ${escapeHtml(MODELAGENS.find(model => model.id === row.modelagem)?.nome || row.modelagem)}` : ''}</p>
          <div class="lote-line-prices"><span>Base ${formatBRL(basePrice)}</span><span>→</span><strong>${formatBRL(unitPrice)} / un.</strong>${discount ? `<span class="lote-discount">-${discount}%</span>` : ''}</div>
        </div>
        <div class="lote-line-controls"><div class="lote-line-stepper" aria-label="Quantidade"><button type="button" data-line-action="minus" data-index="${index}" aria-label="Diminuir quantidade">−</button><output>${row.quantidade}</output><button type="button" data-line-action="plus" data-index="${index}" aria-label="Aumentar quantidade">+</button></div><strong class="lote-line-total">${formatBRL(row.quantidade * unitPrice)}</strong><button type="button" class="lote-remove" data-line-action="remove" data-index="${index}">× Remover</button></div>
      </article>`;
    }).join('');
    if (chip) chip.textContent = `${quantidadeTotal()} ${quantidadeTotal() === 1 ? 'peça' : 'peças'}`;
  }

  function renderResumo() {
    const count = quantidadeTotal();
    const amount = totalLote(count);
    const averagePrice = count ? amount / count : 0;
    document.getElementById('lote-total-pecas').textContent = count;
    document.getElementById('lote-preco-unitario').textContent = formatBRL(averagePrice);
    document.getElementById('lote-valor-total').textContent = formatBRL(amount);
    document.getElementById('lote-mobile-total').textContent = formatBRL(amount);
    document.getElementById('lote-minimo-aviso').textContent = count < 10 ? `Faltam ${10 - count} ${10 - count === 1 ? 'peça' : 'peças'} para atingir o pedido mínimo de 10.` : 'Pedido mínimo de 10 peças atingido.';
    const currentBand = document.getElementById('lote-faixa');
    const nextPriceEl = document.getElementById('lote-proximo-valor');
    if (!count) {
      currentBand.textContent = 'Adicione produtos para calcular o valor do lote.';
      nextPriceEl.textContent = '';
      return;
    }
    currentBand.textContent = `Faixa atual: ${count} ${count === 1 ? 'peça' : 'peças'} no lote · ${formatBRL(averagePrice)} por peça.`;
    const customizable = linhas.some(row => obterProduto(row.produtoId)?.tipoPersonalizacao === 'personalizavel');
    if (!customizable) {
      nextPriceEl.textContent = 'Os produtos deste lote têm preço fixo.';
      return;
    }
    let addCount = 1;
    let nextAvg = averagePrice;
    while (addCount <= 100000) {
      nextAvg = totalLote(count + addCount) / (count + addCount);
      if (nextAvg < averagePrice) break;
      addCount++;
    }
    if (addCount <= 100000 && Number.isFinite(nextAvg)) {
      nextPriceEl.textContent = `Faltam ${addCount} ${addCount === 1 ? 'peça' : 'peças'} para baixar para ${formatBRL(nextAvg)} / un.`;
    } else nextPriceEl.textContent = '';
  }

  function render() {
    renderBuilder();
    renderLinhas();
    renderResumo();
  }

  function atualizarLote() {
    salvar();
    renderLinhas();
    renderResumo();
  }

  function validarMinimo() {
    if (quantidadeTotal() >= 10) return true;
    const missing = 10 - quantidadeTotal();
    cart.showToast(`Adicione mais ${missing} ${missing === 1 ? 'peça' : 'peças'} para completar o mínimo de 10.`, 'erro');
    document.getElementById('lote-minimo-aviso').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }

  function messageOrcamento() {
    const count = quantidadeTotal();
    const rows = linhas.map(row => {
      const product = obterProduto(row.produtoId);
      const model = MODELAGENS.find(value => value.id === row.modelagem)?.nome;
      return `• ${product.nome} — ${row.quantidade} un. — ${row.cor}, ${row.tamanho}${model ? `, ${model}` : ''}`;
    });
    return `Olá! Gostaria de um orçamento para este pedido em lote:\n${rows.join('\n')}\nTotal de peças: ${count}\nValor estimado: ${formatBRL(totalLote(count))}`;
  }

  function gerarOrcamento() {
    if (!validarMinimo()) return;
    const count = quantidadeTotal();
    linhas.forEach(row => {
      const product = obterProduto(row.produtoId);
      if (!product) return;
      cart.addItem(product, row.quantidade, {
        tamanho: row.tamanho,
        cor: row.cor,
        modelagem: row.modelagem,
        precoUnitarioCalculado: precoLinha(row, count)
      });
    });
    window.location.href = 'checkout.html';
  }

  selectProduto.addEventListener('change', () => { builder.produtoId = selectProduto.value; builder.cor = ''; if (!produtoTemModelagem(obterProduto(builder.produtoId))) builder.modelagem = ''; renderBuilder(); });
  document.getElementById('lote-modelagens').addEventListener('click', event => {
    const button = event.target.closest('[data-builder-model]');
    if (!button) return;
    builder.modelagem = button.dataset.builderModel;
    renderBuilder();
  });
  document.getElementById('lote-cores').addEventListener('click', event => {
    const button = event.target.closest('[data-builder-color]');
    if (!button) return;
    builder.cor = button.dataset.builderColor;
    renderBuilder();
  });
  document.getElementById('lote-tamanhos').addEventListener('click', event => {
    const button = event.target.closest('[data-builder-size]');
    if (!button) return;
    builder.tamanho = button.dataset.builderSize;
    renderBuilder();
  });
  document.querySelector('.lote-stepper').addEventListener('click', event => {
    const action = event.target.closest('[data-builder-qty]')?.dataset.builderQty;
    if (!action) return;
    builder.quantidade = Math.max(1, builder.quantidade + (action === 'plus' ? 1 : -1));
    document.getElementById('lote-qtd-builder').textContent = builder.quantidade;
  });
  document.getElementById('btn-add-linha-lote').addEventListener('click', () => {
    const message = document.getElementById('lote-form-message');
    const missing = [];
    if (!builder.produtoId) missing.push('um produto');
    if (produtoTemModelagem(obterProduto(builder.produtoId)) && !builder.modelagem) missing.push('a modelagem');
    if (!builder.cor) missing.push('a cor');
    if (!builder.tamanho) missing.push('o tamanho');
    if (missing.length) {
      message.textContent = `Só falta escolher ${missing.join(', ')} para adicionar a peça.`;
      return;
    }
    message.textContent = '';
    const matching = linhas.find(row => row.produtoId === builder.produtoId && row.modelagem === builder.modelagem && row.cor === builder.cor && row.tamanho === builder.tamanho);
    if (matching) matching.quantidade += builder.quantidade;
    else linhas.push({ ...builder });
    atualizarLote();
  });
  linhasEl.addEventListener('click', event => {
    const button = event.target.closest('[data-line-action]');
    if (!button) return;
    const index = Number(button.dataset.index);
    const action = button.dataset.lineAction;
    if (!linhas[index]) return;
    if (action === 'remove') linhas.splice(index, 1);
    else if (action === 'plus') linhas[index].quantidade += 1;
    else if (action === 'minus') {
      linhas[index].quantidade -= 1;
      if (linhas[index].quantidade < 1) linhas.splice(index, 1);
    }
    atualizarLote();
  });
  document.querySelectorAll('.lote-gerar').forEach(button => button.addEventListener('click', gerarOrcamento));
  document.querySelector('.lote-whatsapp').addEventListener('click', () => {
    if (!validarMinimo()) return;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(messageOrcamento())}`, '_blank', 'noopener');
  });
  document.querySelector('.lote-pdf').addEventListener('click', () => {
    if (!validarMinimo()) return;
    window.print();
  });

  render();
}
