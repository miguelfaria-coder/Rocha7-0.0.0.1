/* effects.js - Efeitos de Rolagem, Hover, Scroll Reveal e Parallax Rocha7 */

const STAGGER_MS = 120; // Atraso configurável entre itens lado a lado (~120ms)

/**
 * Verifica se o usuário prefere movimentos reduzidos ou se está em tela mobile
 */
function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isMobile() {
  return window.innerWidth <= 768;
}

/**
 * 1. SCROLL REVEAL (IntersectionObserver)
 * Títulos, subtítulos, cards, checklist, imagens e rodapé
 * sobem e aparecem ao rolar a página (15% visível, rootMargin -40px embaixo)
 */
let revealObserver = null;

export function initScrollReveal() {
  // Ativa a classe js para progressive enhancement (só esconde se o JS rodar)
  document.documentElement.classList.add("js");

  if (prefersReducedMotion()) {
    // Revelar tudo diretamente sem animação em modo de acessibilidade
    document.querySelectorAll(".reveal, .reveal-img").forEach((el) => {
      el.classList.add("is-visible");
      const div = el.querySelector(".divider");
      if (div) div.classList.add("is-visible");
    });
    return;
  }

  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const target = entry.target;
        // will-change ativo estritamente durante a animação
        target.classList.add("is-animating");
        target.classList.add("is-visible");

        const divider = target.querySelector(".divider");
        if (divider) divider.classList.add("is-visible");

        const cleanupAnimation = () => {
          target.classList.remove("is-animating");
          target.removeEventListener("transitionend", onTransitionEnd);
        };

        const onTransitionEnd = (evt) => {
          if (evt.target === target && (evt.propertyName === "transform" || evt.propertyName === "opacity")) {
            cleanupAnimation();
          }
        };

        target.addEventListener("transitionend", onTransitionEnd);

        // Fallback de segurança para desligar will-change
        setTimeout(cleanupAnimation, 1200);

        // A animação acontece apenas uma vez
        revealObserver.unobserve(target);
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: "0px 0px -40px 0px"
  });

  registerRevealElements();
}

/**
 * Registra todos os elementos que devem ser revelados na página
 * Pode ser chamado novamente após injeções dinâmicas (ex: catálogo/destaques/rodapé)
 */
export function registerRevealElements() {
  if (!revealObserver || prefersReducedMotion()) return;

  function attachReveal(el, delayMs = 0) {
    if (!el || el.dataset.observed === "true" || el.classList.contains("is-visible")) return;
    el.classList.add("reveal");
    if (delayMs > 0) {
      el.style.setProperty("--delay", `${delayMs}ms`);
    }
    el.dataset.observed = "true";
    revealObserver.observe(el);
  }

  function attachRevealImg(img, delayMs = 0) {
    if (!img || img.dataset.observed === "true" || img.classList.contains("is-visible")) return;
    img.classList.add("reveal-img");
    if (delayMs > 0) {
      img.style.setProperty("--delay", `${delayMs}ms`);
    }
    img.dataset.observed = "true";
    revealObserver.observe(img);
  }

  // 1. Títulos de seção, subtítulos e dividers
  document.querySelectorAll(".secao-header").forEach((header) => {
    attachReveal(header, 0);
  });

  // 2. Cards de categorias e suas imagens (stagger de 120ms)
  document.querySelectorAll(".categorias-grid .categoria-card").forEach((card, index) => {
    const delay = index * STAGGER_MS;
    attachReveal(card, delay);
    const img = card.querySelector("img");
    if (img) attachRevealImg(img, delay);
  });

  // 3. Cards de destaque dinâmicos e suas imagens (stagger de 120ms)
  document.querySelectorAll(".destaques-compact-grid .produto-card").forEach((card, index) => {
    const delay = index * STAGGER_MS;
    attachReveal(card, delay);
    const img = card.querySelector("img");
    if (img) attachRevealImg(img, delay);
  });

  // 4. Cards de depoimentos (stagger de 120ms)
  document.querySelectorAll(".depoimentos-grid .depoimento-card").forEach((card, index) => {
    attachReveal(card, index * STAGGER_MS);
  });

  // 5. Seção escura "Vai encomendar para mais de 10 pessoas?"
  const grupoSec = document.querySelector(".secao-grupo");
  if (grupoSec) {
    attachReveal(grupoSec.querySelector(".badge"), 0);
    attachReveal(grupoSec.querySelector("h2"), 80);
    attachReveal(grupoSec.querySelector("p"), 140);

    // Itens do checklist (stagger de 120ms)
    grupoSec.querySelectorAll(".grupo-beneficio").forEach((item, index) => {
      attachReveal(item, 200 + index * STAGGER_MS);
    });

    attachReveal(grupoSec.querySelector("a.btn"), 200 + 3 * STAGGER_MS);

    // Imagem da camiseta preta (com scale 1.08 -> 1)
    const grupoImg = grupoSec.querySelector(".grupo-img img");
    if (grupoImg) attachRevealImg(grupoImg, 120);
  }

  // 6. Colunas do rodapé (stagger de 120ms)
  document.querySelectorAll(".footer-grid .footer-col").forEach((col, index) => {
    attachReveal(col, index * STAGGER_MS);
  });

  // 7. Qualquer outro elemento marcado com .reveal ou .reveal-img
  document.querySelectorAll(".reveal").forEach((el) => {
    attachReveal(el, 0);
  });
  document.querySelectorAll(".reveal-img").forEach((img) => {
    attachRevealImg(img, 0);
  });
}

/**
 * 2. PARALLAX SUTIL
 * A imagem do pedido em lote e as imagens dos cards movem-se
 * um pouco mais devagar que o scroll (deslocamento máx ~25px)
 */
export function initParallax() {
  if (prefersReducedMotion() || isMobile()) return;

  const loteImg = document.querySelector(".grupo-img img");
  const catImgs = Array.from(document.querySelectorAll(".categoria-card img"));

  const targets = [];
  if (loteImg) targets.push({ el: loteImg, max: 28, speed: 0.08 });
  catImgs.forEach((img) => targets.push({ el: img, max: 18, speed: 0.05 }));

  function updateParallax() {
    if (isMobile() || prefersReducedMotion()) {
      targets.forEach((t) => {
        t.el.style.transform = "";
      });
      return;
    }

    const windowH = window.innerHeight;

    targets.forEach((item) => {
      const rect = item.el.getBoundingClientRect();
      if (rect.bottom >= -50 && rect.top <= windowH + 50) {
        const center = rect.top + rect.height / 2;
        const screenCenter = windowH / 2;
        const diff = (center - screenCenter) * item.speed;
        const offset = Math.max(-item.max, Math.min(item.max, diff));
        // Se a imagem já concluiu a animação de reveal, preserva transform normal com parallax sutil
        if (item.el.classList.contains("is-visible") && !item.el.classList.contains("is-animating")) {
          item.el.style.transform = `translateY(${offset.toFixed(1)}px)`;
        }
      }
    });
  }

  let ticking = false;
  window.addEventListener("scroll", () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        updateParallax();
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });

  window.addEventListener("resize", updateParallax, { passive: true });
  updateParallax();
}

/**
 * Inicializador mestre dos efeitos da home
 */
export function initHomeEffects() {
  initScrollReveal();
  initParallax();
}
