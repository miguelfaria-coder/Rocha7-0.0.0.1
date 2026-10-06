/* header.js - Cabeçalho Rocha7 */
import { cart } from '../cart.js';
import { loginUsuario, logoutUsuario } from '../supabase.js';
import { escapeHtml, formatBRL } from '../utils.js';

let outsideClickBound = false;

export function renderHeader() {
  const headerContainer = document.getElementById("site-header");
  if (!headerContainer) return;
  headerContainer.classList.add("site-nav");

  const currentPath = window.location.pathname.split("/").pop() || "index.html";

  headerContainer.innerHTML = `
    <div class="container header-container">
      <!-- LOGO FIEL AO MODELO PHENOMENAL -->
      <a href="index.html" class="site-logo">
        <img src="logo.png" alt="Agência Rocha7" onerror="this.style.display='none'">
        <div class="logo-text-wrapper">
          <span class="logo-title">Rocha7<span class="dot">.</span></span>
          <span class="logo-tagline">Camisetas, moletons e canecas em lote</span>
        </div>
      </a>

      <!-- MENU NAVEGAÇÃO PRINCIPAL -->
      <nav class="main-nav" id="main-nav">
        <ul class="nav-list">
          <li class="nav-item">
            <a href="index.html" class="nav-link ${currentPath === 'index.html' || currentPath === '' ? 'active' : ''}">HOME</a>
          </li>
          <li class="nav-item">
            <a href="catalogo.html" class="nav-link ${currentPath === 'catalogo.html' ? 'active' : ''}">CATÁLOGO</a>
          </li>
          <li class="nav-item">
            <a href="pedido-lote.html" class="nav-link ${currentPath === 'pedido-lote.html' ? 'active' : ''}">PEDIDO EM LOTE</a>
          </li>
          <li class="nav-item">
            <a href="editor.html" class="nav-link ${currentPath === 'editor.html' ? 'active' : ''}">EDITOR ON-LINE</a>
          </li>
          <li class="nav-item">
            <a href="contato.html" class="nav-link ${currentPath === 'contato.html' ? 'active' : ''}">CONTATO</a>
          </li>
        </ul>
      </nav>

      <!-- AÇÕES DO TOPO (BUSCA + LOGIN NO CANTINHO + CARRINHO) -->
      <div class="header-actions">
        <form class="header-search" id="header-search-form" action="catalogo.html" method="GET">
          <input type="text" name="busca" class="header-search-input" placeholder="Buscar..." aria-label="Buscar produtos">
          <button type="submit" class="header-search-btn" title="Buscar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>
        </form>

        <!-- BOTÃO DE LOGIN / CONTA NO CANTINHO -->
        <div class="user-corner-wrapper" id="user-corner-wrapper">
          <!-- Conteúdo dinâmico via JS (renderUserCorner) -->
        </div>

        <button class="cart-icon-btn" id="btn-cart-toggle" title="Ver Carrinho">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <path d="M16 10a4 4 0 0 1-8 0"></path>
          </svg>
          <span class="cart-badge" id="header-cart-badge">0</span>
        </button>

        <button class="mobile-toggle" id="btn-mobile-menu" aria-label="Menu Mobile">
          ☰
        </button>
      </div>
    </div>

    <!-- MODAL / DRAWER DE LOGIN RÁPIDO NO CANTINHO -->
    <div class="login-modal-overlay" id="login-overlay"></div>
    <div class="login-modal-drawer" id="login-drawer">
      <div class="login-drawer-header">
        <div class="login-drawer-title">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--cor-primaria)" stroke-width="2.5">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span>Área do Cliente</span>
        </div>
        <button class="login-drawer-close" id="btn-login-close">&times;</button>
      </div>
      <div class="login-drawer-body">
        <p class="login-drawer-sub">Acesse sua conta Rocha7 para acompanhar pedidos e personalizar produtos.</p>

        <div class="login-drawer-alert" id="login-drawer-alert" style="display: none;"></div>

        <form id="header-login-form">
          <div class="login-field-group">
            <label for="header-email">E-mail</label>
            <input type="email" id="header-email" name="email" placeholder="seu.email@exemplo.com" required>
            <span class="field-error" id="header-email-error"></span>
          </div>

          <div class="login-field-group">
            <label for="header-senha">Senha</label>
            <input type="password" id="header-senha" name="senha" placeholder="••••••••" required>
            <span class="field-error" id="header-senha-error"></span>
          </div>

          <div class="login-field-row">
            <label class="remember-label">
              <input type="checkbox" name="lembrar" checked> Lembrar-me
            </label>
            <a href="login.html" class="forgot-link">Esqueci a senha</a>
          </div>

          <button type="submit" class="btn btn-primario btn-full btn-header-submit" id="btn-header-login-submit">
            Entrar no Sistema
          </button>
        </form>

        <div class="login-drawer-footer">
          <p>Não possui uma conta? <a href="login.html">Cadastre-se aqui</a></p>
          <a href="login.html" class="full-page-link">Abrir tela cheia de Login &rarr;</a>
        </div>
      </div>
    </div>

    <!-- DRAWER MODAL DO CARRINHO -->
    <div class="cart-modal-overlay" id="cart-overlay"></div>
    <div class="cart-modal" id="cart-drawer">
      <div class="cart-header">
        <h3>Seu Carrinho</h3>
        <button class="cart-close-btn" id="btn-cart-close">&times;</button>
      </div>
      <div class="cart-body" id="cart-drawer-items">
        <!-- Renderizado dinamicamente -->
      </div>
      <div class="cart-footer">
        <div class="cart-total-row">
          <span>Total:</span>
          <span class="cart-total-price" id="cart-drawer-total">R$ 0,00</span>
        </div>
        <a href="checkout.html" class="btn btn-primario btn-lg btn-full">Finalizar Compra</a>
      </div>
    </div>
  `;

  // Event Listeners Header Mobile
  const mobileToggle = document.getElementById("btn-mobile-menu");
  const mainNav = document.getElementById("main-nav");
  if (mobileToggle && mainNav) {
    mobileToggle.addEventListener("click", () => {
      mainNav.classList.toggle("active");
    });
  }

  // Cart Drawer Listeners
  const cartToggle = document.getElementById("btn-cart-toggle");
  const cartClose = document.getElementById("btn-cart-close");
  const cartOverlay = document.getElementById("cart-overlay");
  const cartDrawer = document.getElementById("cart-drawer");

  const toggleCartModal = (show) => {
    if (show) {
      cartOverlay.classList.add("active");
      cartDrawer.classList.add("active");
      updateCartDrawerUI();
    } else {
      cartOverlay.classList.remove("active");
      cartDrawer.classList.remove("active");
    }
  };

  if (cartToggle) cartToggle.addEventListener("click", () => toggleCartModal(true));
  if (cartClose) cartClose.addEventListener("click", () => toggleCartModal(false));
  if (cartOverlay) cartOverlay.addEventListener("click", () => toggleCartModal(false));

  // Renderizar o canto de usuário (Login no cantinho) & configurar login drawer
  renderUserCorner();
  setupLoginDrawer();

  // Escutar eventos de atualização do carrinho
  window.addEventListener("cart-updated", (e) => {
    updateBadge(e.detail.totalItens);
    updateCartDrawerUI();
  });

  // Escutar evento de alteração de estado do usuário
  window.addEventListener("user-state-changed", () => {
    renderUserCorner();
  });

  // Atualizar badge inicial do carrinho
  const summary = cart.getSummary();
  updateBadge(summary.totalItens);

  // Ativar smart header (esconde ao descer, mostra ao subir)
  initSmartHeader();
}

/* ============================================================
   SMART HEADER / SITE-NAV FLUTUANTE
   ============================================================ */
function initSmartHeader() {
  const nav = document.querySelector('.site-nav') || document.getElementById('site-header');
  if (!nav) return;

  let lastY = window.scrollY;
  let ticking = false;

  function onScroll() {
    const y = window.scrollY;
    const delta = y - lastY;
    const navH = nav.offsetHeight;

    const blocked = (document.activeElement?.closest('.site-nav') && document.activeElement.matches('input'))
      || document.getElementById('main-nav')?.classList.contains('active')
      || document.getElementById('cart-drawer')?.classList.contains('active')
      || document.getElementById('login-drawer')?.classList.contains('active')
      || document.getElementById('user-dropdown-menu')?.classList.contains('active')
      || document.body.classList.contains('menu-open')
      || document.body.classList.contains('cart-open');

    if (blocked || y <= 0) {
      nav.classList.remove('is-hidden');
      nav.classList.remove('header--hidden');
    } else if (delta > 5 && y > navH) {
      nav.classList.add('is-hidden');      // descendo
      nav.classList.add('header--hidden');
    } else if (delta < -2) {
      nav.classList.remove('is-hidden');   // subindo, qualquer quantidade
      nav.classList.remove('header--hidden');
    }
    lastY = y;
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(onScroll);
      ticking = true;
    }
  }, { passive: true });
}

// Retorna usuário logado se existir no localStorage
function getLoggedUser() {
  try {
    const raw = localStorage.getItem("r7_user");
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// Renderiza o botão e menu do cantinho (Entrar ou Perfil)
function renderUserCorner() {
  const wrapper = document.getElementById("user-corner-wrapper");
  if (!wrapper) return;

  const user = getLoggedUser();

  if (user && user.nome) {
    const firstName = user.nome.split(" ")[0];
    wrapper.innerHTML = `
      <div class="user-corner-relative">
        <button class="user-corner-btn logged-in" id="btn-user-corner" title="Minha Conta">
          <div class="user-avatar-circle">${escapeHtml(firstName.charAt(0).toUpperCase())}</div>
          <span class="user-name-text">Olá, <strong>${escapeHtml(firstName)}</strong></span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="user-chevron">
            <path d="M6 9l6 6 6-6"></path>
          </svg>
        </button>

        <div class="user-dropdown-popover" id="user-dropdown-menu">
          <div class="dropdown-user-info">
            <div class="user-info-name">${escapeHtml(user.nome)}</div>
            <div class="user-info-email">${escapeHtml(user.email || 'Cliente Rocha7')}</div>
          </div>
          <ul class="dropdown-menu-list">
            <li>
              <a href="checkout.html">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                </svg>
                Meus Pedidos
              </a>
            </li>
            <li>
              <a href="login.html">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                Perfil / Conta
              </a>
            </li>
            <li class="dropdown-divider"></li>
            <li>
              <button class="dropdown-logout-btn" id="btn-logout-corner">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                Sair
              </button>
            </li>
          </ul>
        </div>
      </div>
    `;

    const userBtn = document.getElementById("btn-user-corner");
    const userMenu = document.getElementById("user-dropdown-menu");
    const logoutBtn = document.getElementById("btn-logout-corner");

    if (userBtn && userMenu) {
      userBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        userMenu.classList.toggle("active");
      });

      if (!outsideClickBound) {
        outsideClickBound = true;
        document.addEventListener("click", (e) => {
          const menu = document.getElementById("user-dropdown-menu");
          const btn = document.getElementById("btn-user-corner");
          if (menu && btn && !menu.contains(e.target) && !btn.contains(e.target)) {
            menu.classList.remove("active");
          }
        });
      }
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        try {
          await logoutUsuario();
        } catch (err) {
          console.warn("Logout remoto indisponível:", err);
        }
        localStorage.removeItem("r7_user");
        window.dispatchEvent(new Event("user-state-changed"));
      });
    }
  } else {
    wrapper.innerHTML = `
      <button class="user-corner-btn" id="btn-user-corner" title="Entrar na Conta">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <span class="user-name-text">Entrar</span>
      </button>
    `;

    const userBtn = document.getElementById("btn-user-corner");
    if (userBtn) {
      userBtn.addEventListener("click", () => {
        toggleLoginDrawer(true);
      });
    }
  }
}

// Abrir/Fechar Modal de Login no cantinho
function toggleLoginDrawer(show) {
  const overlay = document.getElementById("login-overlay");
  const drawer = document.getElementById("login-drawer");
  if (!overlay || !drawer) return;

  if (show) {
    overlay.classList.add("active");
    drawer.classList.add("active");
    const emailInput = document.getElementById("header-email");
    if (emailInput) setTimeout(() => emailInput.focus(), 150);
  } else {
    overlay.classList.remove("active");
    drawer.classList.remove("active");
  }
}

// Listeners e envio do form de login no modal drawer
function setupLoginDrawer() {
  const overlay = document.getElementById("login-overlay");
  const closeBtn = document.getElementById("btn-login-close");
  const form = document.getElementById("header-login-form");

  if (overlay) overlay.addEventListener("click", () => toggleLoginDrawer(false));
  if (closeBtn) closeBtn.addEventListener("click", () => toggleLoginDrawer(false));

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const emailInput = document.getElementById("header-email");
    const senhaInput = document.getElementById("header-senha");
    const emailErr = document.getElementById("header-email-error");
    const senhaErr = document.getElementById("header-senha-error");
    const alertBox = document.getElementById("login-drawer-alert");
    const submitBtn = document.getElementById("btn-header-login-submit");

    if (emailErr) emailErr.textContent = "";
    if (senhaErr) senhaErr.textContent = "";
    if (alertBox) alertBox.style.display = "none";

    let isValid = true;
    if (!emailInput.value.trim()) {
      if (emailErr) emailErr.textContent = "Informe seu e-mail";
      isValid = false;
    }
    if (!senhaInput.value.trim()) {
      if (senhaErr) senhaErr.textContent = "Informe sua senha";
      isValid = false;
    }
    if (!isValid) return;

    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Autenticando...";

    const email = emailInput.value.trim();
    const senha = senhaInput.value;
    const nomePadrao = email.split("@")[0];

    const salvarSessao = (nome, mail) => {
      localStorage.setItem("r7_user", JSON.stringify({ nome, email: mail }));
      toggleLoginDrawer(false);
      renderUserCorner();
    };

    try {
      const data = await loginUsuario(email, senha);
      const nome = data.user?.user_metadata?.nome || nomePadrao;
      salvarSessao(nome, email);
    } catch (err) {
      const msg = err?.message || String(err);
      if (/não configurado|not configured|Failed to fetch|NetworkError/i.test(msg)) {
        const formattedName = nomePadrao.charAt(0).toUpperCase() + nomePadrao.slice(1);
        salvarSessao(formattedName, email);
      } else if (alertBox) {
        alertBox.textContent = msg || "Credenciais inválidas.";
        alertBox.style.display = "block";
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

function updateBadge(count) {
  const badge = document.getElementById("header-cart-badge");
  if (badge) {
    badge.textContent = count;
  }
}

function updateCartDrawerUI() {
  const container = document.getElementById("cart-drawer-items");
  const totalEl = document.getElementById("cart-drawer-total");
  if (!container || !totalEl) return;

  const summary = cart.getSummary();
  totalEl.textContent = formatBRL(summary.valorTotal);

  if (summary.items.length === 0) {
    container.innerHTML = `<div class="cart-empty"><p>Seu carrinho está vazio.</p></div>`;
    return;
  }

  container.innerHTML = summary.items.map(item => `
    <div class="cart-item">
      <img src="${escapeHtml(item.imagem)}" alt="${escapeHtml(item.nome)}" class="cart-item-img">
      <div class="cart-item-info">
        <div class="cart-item-title">${escapeHtml(item.nome)}</div>
        <div class="cart-item-meta">Tam: ${escapeHtml(item.tamanho)} | Cor: ${escapeHtml(item.cor)}</div>
        <div class="cart-item-price">${item.quantidade}x ${formatBRL(item.precoUnitario)}</div>
      </div>
      <button class="cart-item-remove" data-key="${escapeHtml(item.key)}" title="Remover">&times;</button>
    </div>
  `).join('');

  // Remover evento listener
  container.querySelectorAll(".cart-item-remove").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const key = e.currentTarget.getAttribute("data-key");
      cart.removeItem(key);
    });
  });
}

if (typeof window !== 'undefined') {
  window.renderHeader = renderHeader;
}

