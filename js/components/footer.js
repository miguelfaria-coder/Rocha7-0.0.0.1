/* footer.js - Renderizador e Controlador do Rodapé (Modelo Phenomenal) */

export function renderFooter() {
  const footerContainer = document.getElementById("site-footer");
  if (!footerContainer) return;

  footerContainer.innerHTML = `
    <!-- TRIÂNGULO NOTCH TOPO CENTRAL (Modelo Phenomenal) -->
    <div class="footer-top-notch"></div>

    <div class="footer-main">
      <div class="container footer-grid">
        
        <!-- COLUNA 1: SOBRE -->
        <div class="footer-col reveal">
          <h4>Sobre a Rocha7</h4>
          <p>
            Uniformes e camisetas personalizadas em lote para igrejas, ministérios, congressos e lideranças.
            Tecido de primeira linha e estampa com prévia antes da produção.
          </p>
        </div>

        <!-- COLUNA 2: TAGS DA GALERIA (Pills do modelo Phenomenal) -->
        <div class="footer-col reveal">
          <h4>Categorias & Tags</h4>
          <div class="footer-tags">
            <a href="catalogo.html?categoria=camisa" class="footer-tag">camisetas</a>
            <a href="catalogo.html?categoria=moletom" class="footer-tag">moletons</a>
            <a href="catalogo.html?categoria=caneca" class="footer-tag">canecas</a>
            <a href="catalogo.html?estilo=polo" class="footer-tag">polo malha fria</a>
            <a href="catalogo.html?estilo=baby-look" class="footer-tag">baby look</a>
            <a href="pedido-lote.html" class="footer-tag">pedido em lote</a>
            <a href="editor.html" class="footer-tag">editor 3d</a>
            <a href="contato.html" class="footer-tag">orçamentos</a>
          </div>
        </div>

        <!-- COLUNA 3: CONTATO E INFORMAÇÕES -->
        <div class="footer-col reveal">
          <h4>Informações de Contato</h4>
          <div class="footer-contact-list">
            <div class="footer-contact-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <span><strong>Endereço:</strong> Rua dos Uniformes 125, São Paulo - SP</span>
            </div>
            <div class="footer-contact-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
              <span><strong>Atendimento WhatsApp:</strong> (11) 99999-9999</span>
            </div>
            <div class="footer-contact-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              <span><strong>E-mail:</strong> contato@agenciarocha7.com.br</span>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- BARRA INFERIOR LARANJA (Modelo Phenomenal) -->
    <div class="footer-bottom-bar">
      <div class="container footer-bottom-container">
        <div class="footer-copyright">
          Copyright © 2026 Agência Rocha7 — Todos os Direitos Reservados
        </div>
        <div class="footer-credits">
          <span>Feito para pedidos em lote</span>
          <button id="go-top-btn" class="go-top-btn">Voltar ao Topo ↑</button>
        </div>
      </div>
    </div>
  `;

  // Go top smooth scroll listener
  const goTopBtn = document.getElementById("go-top-btn");
  if (goTopBtn) {
    goTopBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}

if (typeof window !== 'undefined') {
  window.renderFooter = renderFooter;
}
