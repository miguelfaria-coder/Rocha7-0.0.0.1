/* home.js - Página inicial Rocha7 */
import { renderHeader } from "../components/header.js";
import { renderFooter } from "../components/footer.js";
import { carregarProdutos } from "../data/products.js";
import { cart } from "../cart.js";
import { escapeHtml, formatBRL } from "../utils.js";
import { initHomeEffects, registerRevealElements } from "../effects.js";

let PRODUTOS = [];

document.addEventListener("DOMContentLoaded", async () => {
  renderHeader();
  renderFooter();
  renderHeroSection();

  // Inicializar efeitos da página (Reveal, Pin do checklist e Parallax)
  initHomeEffects();

  try {
    PRODUTOS = await carregarProdutos();
  } catch (err) {
    console.warn("Usando catálogo local na home:", err);
  }

  renderDestaques();

  // Registrar cards dinâmicos recém-injetados de destaques no reveal
  registerRevealElements();
});

function renderHeroSection() {
  const heroSection = document.querySelector(".hero");
  if (!heroSection) return;

  heroSection.innerHTML = `
    <!-- Topbar interna do banner (logo decorativo + redes sociais) -->
    <div class="hero-topbar">
      <div class="hero-logo-area">
        <button class="hero-hamburger" aria-label="Menu" type="button">
          <span></span>
          <span></span>
          <span></span>
        </button>
        <a href="index.html" class="hero-logo-text">Rocha7<span class="hero-logo-dot">.</span></a>
      </div>
      <div class="hero-social-icons">
        <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
        </a>
        <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter / X">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/></svg>
        </a>
        <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
        </a>
      </div>
    </div>

    <!-- Conteúdo principal do hero (grid 2 colunas) -->
    <div class="hero-inner">
      <div class="hero-copy">
        <h1 class="hero-title">Camisetas e<br>uniformes<br><span class="hero-title-nowrap">para o seu congresso.</span></h1>
        <p class="hero-desc">
          A Rocha7 produz camisetas, polos, moletons e canecas com arte própria.
          Quanto maior o lote da mesma estampa, menor o preço por peça.
          Venha conhecer e se encantar.
        </p>
        <a href="catalogo.html" class="hero-cta-btn">Ver Catálogo</a>
      </div>

      <div class="hero-product">
        <img
          id="hero-product-img"
          src="assets/img/produtos/hero-produtos.png"
          alt="Produtos personalizados Rocha7 — Moletom, camiseta e caneca"
          loading="eager"
          decoding="async"
          width="520"
          height="520"
        >
      </div>
    </div>

    <!-- Rodapé do banner (contato + endereço) -->
    <div class="hero-bottom-bar">
      <div class="hero-contact">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
        </svg>
        <a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer">(11) 99999-9999</a>
      </div>
      <div class="hero-bottom-divider"></div>
      <div class="hero-address">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        <span>Rua dos Uniformes 125, São Paulo - SP</span>
      </div>
    </div>
  `;

  // Ativar animação de flutuação contínua após a entrada inicial
  const productImg = document.getElementById("hero-product-img");
  if (productImg) {
    const activateFloat = () => {
      productImg.classList.add("hero-float");
    };
    productImg.addEventListener("animationend", (e) => {
      if (e.animationName === "heroFadeZoom") {
        activateFloat();
      }
    }, { once: true });
    // Fallback garantido caso animationend já tenha ocorrido
    setTimeout(activateFloat, 1200);
  }
}

function renderDestaques() {
  const container = document.getElementById("destaques-container");
  if (!container) return;

  // Os 4 produtos exatos solicitados para o destaque da home:
  // 1. Camiseta Algodão Liso Premium (prod-1)
  // 2. Camisa Polo Tradicional Lisa (prod-4)
  // 3. Moletom Canguru Liso Flanelado (prod-8)
  // 4. Caneca Cerâmica Resina Premium (prod-10)
  const idsDestaques = ["prod-1", "prod-4", "prod-8", "prod-10"];
  let destaques = idsDestaques
    .map((id) => (PRODUTOS || []).find((p) => String(p.id) === id))
    .filter(Boolean);

  // Fallback caso algum não seja localizado por ID
  if (destaques.length < 4) {
    const outros = (PRODUTOS || []).filter((p) => p.destaque && !destaques.includes(p));
    destaques = [...destaques, ...outros].slice(0, 4);
  }

  if (!destaques.length) {
    container.innerHTML = `<p class="texto-sec">Catálogo em carregamento. Abra o <a href="catalogo.html">catálogo completo</a>.</p>`;
    return;
  }

  container.innerHTML = destaques.map((produto) => `
    <article class="produto-card">
      <a href="produto.html?id=${encodeURIComponent(produto.id)}" class="produto-img-wrapper">
        <span class="badge badge-destaque produto-badge">Destaque</span>
        <img src="${escapeHtml(produto.imagem)}" alt="${escapeHtml(produto.nome)}">
      </a>
      <div class="produto-info">
        <span class="produto-categoria">${escapeHtml(produto.categoria)}</span>
        <h3 class="produto-titulo">
          <a href="produto.html?id=${encodeURIComponent(produto.id)}">${escapeHtml(produto.nome)}</a>
        </h3>
        <div class="produto-preco-wrapper">
          <span class="preco">${formatBRL(produto.precoBase)}</span>
          <button type="button" class="btn btn-sm btn-primario btn-add-cart-fast" data-id="${escapeHtml(produto.id)}">
            Adicionar
          </button>
        </div>
      </div>
    </article>
  `).join("");

  container.querySelectorAll(".btn-add-cart-fast").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const prodId = e.currentTarget.getAttribute("data-id");
      const produto = PRODUTOS.find((p) => String(p.id) === String(prodId));
      if (produto && cart) {
        cart.addItem(produto, 1);
      }
    });
  });
}
