import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { carregarProdutos, PRODUTOS as LOCAIS, calcularPrecoUnitario } from '../data/products.js';
import { cart } from '../cart.js';
import { escapeHtml, formatBRL } from '../utils.js';

const SIZES = ['PP','P','M','G','GG','XP','XM','XG','G1','G2','G3'];
const COLORS = { branco:'#fff', preto:'#222', cinza:'#888', 'azul-marinho':'#1a2e5a', rosa:'#f4a7b9', vermelho:'#c53535', azul:'#2764a5', verde:'#398451' };
const medidas = `<div class="medidas-modal-overlay" id="medidas-overlay"></div><section class="medidas-modal" id="medidas-modal" role="dialog" aria-modal="true"><header><strong>Guia de medidas</strong><button id="medidas-fechar" aria-label="Fechar">×</button></header><div class="medidas-table-wrapper"><table class="medidas-table"><thead><tr><th>Tamanho</th><th>Largura</th><th>Comprimento</th></tr></thead><tbody>${[['PP','—','—'],['P','51 cm','70 cm'],['M','55 cm','74 cm'],['G','59 cm','78 cm'],['GG','63 cm','82 cm'],['XP / G1','68 cm','85 cm'],['XM / G2','70 cm','85 cm'],['XG / G3','78 cm','90 cm']].map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p>Medidas aproximadas, podem variar em até 2 cm.</p></section>`;

document.addEventListener('DOMContentLoaded', async () => {
  renderHeader(); renderFooter();
  const container = document.getElementById('produto-container');
  const id = new URLSearchParams(location.search).get('id');
  let produtos = LOCAIS;
  try { produtos = await carregarProdutos(); } catch (e) { console.warn('Não foi possível carregar o catálogo remoto.', e); }
  const produto = produtos.find(p => String(p.id) === String(id));
  if (!produto) { container.innerHTML='<p class="produto-nao-encontrado">Produto não encontrado. <a href="catalogo.html">Voltar ao catálogo</a></p>'; return; }
  const images = [...new Set([...(produto.imagens || []), produto.imagem].filter(Boolean))];
  const categoriaProduto = String(produto.categoria || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const ofereceModelagem = categoriaProduto.includes('camis') || categoriaProduto.includes('camisa') || produto.estilo === 'polo';
  let color = '', model = ofereceModelagem ? 'classico' : '', size = '', quantity = 10, image = images[0];
  const preco10 = calcularPrecoUnitario(produto,10)*10;
  const name = escapeHtml(produto.nome);
  const stars = '★★★★★';
  const details = produto.descricao || 'Uma peça confortável, preparada para acompanhar o dia a dia.';
  const cards = (list, current) => list.filter(p=>String(p.id)!==String(current.id)).slice(0,4).map(p=>`<a class="produto-rel-card" href="produto.html?id=${encodeURIComponent(p.id)}"><img src="${escapeHtml(p.imagem)}" alt="${escapeHtml(p.nome)}" loading="lazy"><strong>${escapeHtml(p.nome)}</strong><span>${formatBRL(p.precoBase)} / un.</span></a>`).join('');
  function render() {
    const pics = [...new Set([...(produto.imagens || []), image].filter(Boolean))];
    container.innerHTML = `
      <a class="produto-voltar" href="catalogo.html">← Voltar ao catálogo</a>
      <section class="produto-detalhe-grid">
        <div class="produto-media ${images.length > 1 ? 'com-miniaturas' : 'sem-miniaturas'}">${images.length > 1 ? `<div class="produto-miniaturas">${images.map(src=>`<button class="produto-mini ${src===image?'ativo':''}" data-image="${escapeHtml(src)}"><img src="${escapeHtml(src)}" alt="${name}"></button>`).join('')}</div>` : ''}<div class="produto-foto"><img id="produto-imagem-principal" src="${escapeHtml(image)}" alt="${name}"><button class="produto-lupa" aria-label="Ampliar imagem">⌕</button></div></div>
        <div class="produto-info-detalhe"><span class="produto-selo">${produto.destaque?'Destaque':escapeHtml(produto.categoria || 'Produto')}</span><h1>${name}</h1><div class="produto-rating"><span>${stars}</span> ${Number(produto.avaliacao||5).toFixed(1)} / 5</div><div class="produto-precos"><strong>${formatBRL(calcularPrecoUnitario(produto,10))} / un.</strong><span>Lote de 10 un.: ${formatBRL(preco10)}</span></div><span class="cat-min-tag">Min. 10 peças</span><p class="produto-descricao">${escapeHtml(details)}</p><hr>
          <div class="produto-opcao"><div class="produto-opcao-titulo">COR: <span>${color?escapeHtml(color):'Selecione uma cor'}</span></div><div class="produto-cores">${(produto.cores||[]).map(c=>`<button class="produto-cor ${c===color?'ativo':''}" data-color="${escapeHtml(c)}" title="${escapeHtml(c)}" aria-label="Cor ${escapeHtml(c)}" style="--swatch:${COLORS[c.toLowerCase()]||'#aaa'}"></button>`).join('')}</div></div>
          ${ofereceModelagem ? `<div class="produto-opcao"><div class="produto-opcao-titulo">MODELAGEM</div><div class="produto-botoes">${['classico','babyLook'].map((m,i)=>`<button class="produto-escolha ${model===m?'ativo':''}" data-model="${m}">${i?'Baby Look':'Clássico'}</button>`).join('')}</div></div>` : ''}
          <div class="produto-opcao"><div class="produto-opcao-titulo">TAMANHO: <span>${size||'Selecione'}</span><button class="produto-guia" id="abrir-medidas">Guia de medidas</button></div><div class="produto-botoes produto-tamanhos">${SIZES.map(s=>`<button class="produto-escolha ${size===s?'ativo':''}" data-size="${s}">${s}</button>`).join('')}</div></div>
          <div class="produto-opcao"><div class="produto-opcao-titulo">QUANTIDADE</div><div class="produto-quantidade"><button id="menos" aria-label="Diminuir">−</button><input id="quantidade" type="number" min="10" step="1" value="${quantity}"><button id="mais" aria-label="Aumentar">+</button><span>peças</span></div></div><p id="produto-aviso" role="alert"></p><button class="produto-adicionar" id="adicionar"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14h18V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/></svg> ADICIONAR AO PEDIDO</button><div class="produto-beneficios"><span>♧ Pedido mínimo de 10 peças</span><span>⌁ Entrega para todo o Brasil</span><span>♢ Pagamento seguro</span></div>
        </div>
      </section>
      <section class="produto-abas"><div class="produto-abas-col"><nav class="produto-tab-list">${['Detalhes','Materiais','Tamanhos e Medidas','Prazo e Entrega'].map((t,i)=>`<button class="produto-tab ${i===0?'ativo':''}" data-tab="${i}">${t}</button>`).join('')}</nav><div class="produto-tab-conteudo" id="tab-conteudo">${escapeHtml(details)}<ul><li>Confortável e versátil</li><li>Acabamento de qualidade</li><li>Ideal para grupos e eventos</li></ul></div></div><img class="produto-destaque-foto" src="${escapeHtml(images[1]||images[0])}" alt="Detalhe de ${name}" loading="lazy"></section>
      <section class="produto-relacionados"><header><h2>Você também pode gostar</h2><a href="catalogo.html">Ver todos →</a></header><div class="produto-rel-grid">${cards(produtos,produto)}</div></section>${medidas}<div class="produto-lightbox" id="produto-lightbox"><button aria-label="Fechar">×</button><img src="${escapeHtml(image)}" alt="${name}"></div>`;
    container.querySelectorAll('[data-image]').forEach(b=>b.onclick=()=>{image=b.dataset.image;render();});
    container.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{color=b.dataset.color; const byColor=produto.imagensPorCor?.[color]||produto.imagens_por_cor?.[color]; if(byColor) image=Array.isArray(byColor)?byColor[0]:byColor;render();});
    container.querySelectorAll('[data-model]').forEach(b=>b.onclick=()=>{model=b.dataset.model;render();});
    container.querySelectorAll('[data-size]').forEach(b=>b.onclick=()=>{size=b.dataset.size;render();});
    const qty=container.querySelector('#quantidade'); qty.onchange=()=>{quantity=Math.max(10,parseInt(qty.value,10)||10);render();};
    container.querySelector('#menos').onclick=()=>{quantity=Math.max(10,quantity-1);render();}; container.querySelector('#mais').onclick=()=>{quantity++;render();};
    container.querySelector('#adicionar').onclick=()=>{const missing=[];if(!color)missing.push('cor');if(ofereceModelagem && !model)missing.push('modelagem');if(!size)missing.push('tamanho');const warning=container.querySelector('#produto-aviso');if(missing.length){warning.textContent=`Selecione ${missing.join(', ')} para adicionar ao pedido.`;return;}cart.addItem(produto,quantity,{cor:color,modelagem:model,tamanho:size,precoUnitarioCalculado:calcularPrecoUnitario(produto,quantity)});};
    container.querySelector('#abrir-medidas').onclick=()=>{container.querySelector('#medidas-modal').classList.add('active');container.querySelector('#medidas-overlay').classList.add('active');};
    const close=()=>{container.querySelector('#medidas-modal').classList.remove('active');container.querySelector('#medidas-overlay').classList.remove('active');};container.querySelector('#medidas-fechar').onclick=close;container.querySelector('#medidas-overlay').onclick=close;
    container.querySelector('.produto-lupa').onclick=()=>{const box=container.querySelector('#produto-lightbox');box.classList.add('active');box.querySelector('img').src=image;};container.querySelector('#produto-lightbox button').onclick=()=>container.querySelector('#produto-lightbox').classList.remove('active');
    const contents=[`${escapeHtml(details)}<ul><li>Confortável e versátil</li><li>Acabamento de qualidade</li><li>Ideal para grupos e eventos</li></ul>`,escapeHtml(produto.material||'Tecido selecionado para oferecer conforto e durabilidade.'),'Consulte o guia de medidas e escolha o tamanho adequado.','Entrega para todo o Brasil. O prazo é informado no checkout.'];container.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{container.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('ativo',x===b));container.querySelector('#tab-conteudo').innerHTML=contents[Number(b.dataset.tab)];});
  }
  render();
});
