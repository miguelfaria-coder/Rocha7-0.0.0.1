/* checkout.js - Script do Processo de Finalização de Compra */
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { cart } from '../cart.js';
import { escapeHtml, formatBRL } from '../utils.js';


const CHECKOUT_ATTEMPT_STORAGE_KEY = "rocha7_checkout_attempt_v1";
let checkoutAttemptMemory = null;

function formatCpfCnpj(value) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) {
    if (digits.length > 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    if (digits.length > 6) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    if (digits.length > 3) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    return digits;
  }
  if (digits.length > 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  if (digits.length > 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  if (digits.length > 5) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length > 2) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return digits;
}

function bindCpfCnpjMask(input) {
  if (!input || input.dataset.maskBound === 'true') return;
  input.dataset.maskBound = 'true';
  input.maxLength = 18;
  input.value = formatCpfCnpj(input.value);
  input.addEventListener('input', () => {
    const cursor = input.selectionStart ?? input.value.length;
    const digitsBeforeCursor = input.value.slice(0, cursor).replace(/\D/g, '').length;
    input.value = formatCpfCnpj(input.value);
    let newCursor = 0;
    let seenDigits = 0;
    while (newCursor < input.value.length && seenDigits < digitsBeforeCursor) {
      if (/\d/.test(input.value[newCursor])) seenDigits++;
      newCursor++;
    }
    while (/[.\/-]/.test(input.value[newCursor] || '') && newCursor < input.value.length) newCursor++;
    input.setSelectionRange(newCursor, newCursor);
  });
}

function createUuidV4() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
  return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
}

async function getCheckoutAttemptKey(order, items) {
  // Só o hash fica persistido; os dados pessoais não são gravados nesta chave local.
  const fingerprintSource = JSON.stringify({
    order: {
      nome: order.nome, email: order.email, telefone: order.telefone,
      cpf: order.cpf, endereco: order.endereco, cep: order.cep,
      formaPagamento: order.formaPagamento, tipoPedido: order.tipoPedido
    },
    items: items.map(item => ({
      id: item.id, tamanho: item.tamanho, cor: item.cor,
      quantidade: item.quantidade, customDesign: item.customDesign || null
    }))
  });

  let fingerprint = null;
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(fingerprintSource));
    fingerprint = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
  }

  if (checkoutAttemptMemory?.fingerprintSource === fingerprintSource) return checkoutAttemptMemory.key;

  if (fingerprint) {
    try {
      const stored = JSON.parse(localStorage.getItem(CHECKOUT_ATTEMPT_STORAGE_KEY) || "null");
      if (stored?.fingerprint === fingerprint && /^[0-9a-f-]{36}$/i.test(stored.key || "")) {
        checkoutAttemptMemory = { fingerprintSource, fingerprint, key: stored.key };
        return stored.key;
      }
    } catch {
      // Sem armazenamento persistente, a idempotência fica limitada à página atual.
    }
  }

  const key = createUuidV4();
  checkoutAttemptMemory = { fingerprintSource, fingerprint, key };
  if (fingerprint) {
    try {
      localStorage.setItem(CHECKOUT_ATTEMPT_STORAGE_KEY, JSON.stringify({ fingerprint, key }));
    } catch {
      // O envio ainda funciona sem armazenamento persistente.
    }
  }
  return key;
}

document.addEventListener("DOMContentLoaded", () => {
  renderHeader();
  renderFooter();
  initCheckout();
});

function initCheckout() {
  const container = document.getElementById("checkout-container");
  if (!container) return;

  function renderView() {
    const summary = cart.getSummary();

    if (summary.items.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 64px 0;">
          <h2>Seu carrinho está vazio</h2>
          <p class="texto-sec" style="margin-bottom: 24px;">Adicione alguns produtos do catálogo para finalizar o seu pedido.</p>
          <a href="catalogo.html" class="btn btn-primario btn-lg">Explorar Catálogo →</a>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="checkout-grid">
        <!-- FORMULÁRIO DE IDENTIFICAÇÃO -->
        <div class="checkout-secao">
          <h3 class="checkout-secao-titulo">Dados para Entrega & Faturamento</h3>
          <form id="form-checkout">
            <div class="form-group" style="margin-bottom: 16px;">
              <label class="form-label">Nome da Igreja / Organização ou Pessoa Física</label>
              <input type="text" class="form-input" id="check-nome" placeholder="Ex: Igreja Boa Nova / Pr. Roberto" required>
            </div>
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom: 16px;">
              <div class="form-group">
                <label class="form-label">E-mail para Confirmação</label>
                <input type="email" class="form-input" id="check-email" placeholder="seu@email.com" required>
              </div>
              <div class="form-group">
                <label class="form-label">WhatsApp para Contato</label>
                <input type="tel" class="form-input" id="check-tel" placeholder="(11) 99999-9999" required>
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 16px;">
              <label class="form-label">CPF ou CNPJ para Nota Fiscal / Faturamento</label>
              <input type="text" class="form-input" id="check-cpf" placeholder="000.000.000-00" required>
            </div>

            <div style="display:grid; grid-template-columns: 2fr 1fr; gap:16px; margin-bottom: 16px;">
              <div class="form-group">
                <label class="form-label">Endereço de Entrega Completo</label>
                <input type="text" class="form-input" id="check-rua" placeholder="Rua, número, complemento, bairro..." required>
              </div>
              <div class="form-group">
                <label class="form-label">CEP</label>
                <input type="text" class="form-input" id="check-cep" placeholder="00000-000" required>
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 24px;">
              <label class="form-label">Forma de Pagamento Preferencial</label>
              <select class="form-input" id="check-pagamento">
                <option value="pix">PIX (5% de Desconto para Igrejas)</option>
                <option value="boleto">Boleto Faturado (Sob Consulta)</option>
                <option value="cartao">Cartão de Crédito em até 10x</option>
              </select>
            </div>

            <div class="checkout-save-profile" id="checkout-save-profile" style="display:none;">
              <label class="checkout-save-profile-label" for="check-salvar-perfil">
                <input type="checkbox" id="check-salvar-perfil" disabled>
                <span><strong>Salvar estes dados na minha conta</strong><small>Use as informações em próximas compras, podendo alterá-las no Perfil / Conta.</small></span>
              </label>
              <p class="checkout-save-profile-help" id="checkout-save-profile-help">Verificando sua conta...</p>
            </div>

            <button type="submit" class="btn btn-primario btn-lg btn-full">
              Confirmar & Gerar Pedido
            </button>
          </form>
        </div>

        <!-- RESUMO DO PEDIDO -->
        <div class="resumo-card">
          <h3 class="resumo-titulo">Resumo do Pedido</h3>
          
          <div style="display:flex; flex-direction:column; gap:12px; max-height: 240px; overflow-y:auto;">
            ${summary.items.map(item => `
              <div style="display:flex; justify-content:space-between; font-size:13px; border-bottom:1px solid var(--cor-borda); padding-bottom:8px;">
                <div>
                  <strong>${escapeHtml(item.nome)}</strong> (${escapeHtml(item.tamanho)})
                  <div class="texto-xs texto-sec">${item.quantidade}x ${formatBRL(item.precoUnitario)}</div>
                </div>
                <strong style="color:var(--cor-primaria)">${formatBRL(item.quantidade * item.precoUnitario)}</strong>
              </div>
            `).join('')}
          </div>

          <div class="resumo-linha total">
            <span>Valor Total:</span>
            <span class="valor">${formatBRL(summary.valorTotal)}</span>
          </div>

          <p class="texto-xs texto-sec">Após a confirmação, nossa equipe entrará em contato via WhatsApp para aprovação da amostra virtual da estampa!</p>
        </div>
      </div>
    `;

    const formCheckout = container.querySelector("#form-checkout");
    bindCpfCnpjMask(container.querySelector("#check-cpf"));
    if (formCheckout) {
      formCheckout.addEventListener("submit", async (e) => {
        e.preventDefault();

        const submitBtn = formCheckout.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Gravando Pedido...";
        }

        const nome = document.getElementById("check-nome")?.value || "";
        const email = document.getElementById("check-email")?.value || "";
        const telefone = document.getElementById("check-tel")?.value || "";
        const endereco = document.getElementById("check-rua")?.value || "";
        const cep = document.getElementById("check-cep")?.value || "";
        const cpf = document.getElementById("check-cpf")?.value || "";
        const formaPagamento = document.getElementById("check-pagamento")?.value || "pix";

        const dadosPedido = {
          nome,
          email,
          telefone,
          cpf,
          endereco,
          cep,
          formaPagamento,
          tipoPedido: 'varejo',
          valorTotal: summary.valorTotal
        };

        let pedidoConfirmado = null;
        let perfilFoiSalvo = false;
        let falhaAoSalvarPerfil = false;
        const salvarPerfilSolicitado = Boolean(document.getElementById("check-salvar-perfil")?.checked);
        try {
          const { criarPedidoSupabase, obterUsuarioAtual, atualizarPerfilUsuario } = await import('../supabase.js');
          const usuario = await obterUsuarioAtual();
          if (usuario) dadosPedido.usuarioId = usuario.id;

          // Salvar os dados do checkout no perfil é opcional e separado da criação do pedido.
          if (usuario && salvarPerfilSolicitado) {
            try {
              await atualizarPerfilUsuario(usuario.id, { nome, email, telefone, cpf, endereco, cep });
              perfilFoiSalvo = true;
            } catch (errPerfil) {
              falhaAoSalvarPerfil = true;
              console.warn("Aviso ao salvar dados no perfil:", errPerfil);
            }
          }

          dadosPedido.idempotenciaId = await getCheckoutAttemptKey(dadosPedido, summary.items);
          pedidoConfirmado = await criarPedidoSupabase(dadosPedido, summary.items);
          try { localStorage.removeItem(CHECKOUT_ATTEMPT_STORAGE_KEY); } catch {}
          checkoutAttemptMemory = null;
          console.log("Pedido salvo com confirmação do servidor.");
        } catch (err) {
          console.error("Falha ao salvar pedido no Supabase:", err);
          container.innerHTML = `
            <div style="text-align: center; padding: 64px 0;">
              <h2>Não foi possível registrar seu pedido</h2>
              <p class="texto-sec" style="margin-bottom: 24px;">Seus itens continuam no carrinho. Verifique sua conexão e tente novamente. Se o problema persistir, entre em contato com a equipe.</p>
              <button type="button" class="btn btn-primario btn-lg" id="checkout-tentar-novamente">Tentar novamente</button>
              <p class="texto-xs texto-sec" style="margin-top: 12px;">Nenhuma confirmação de pedido foi emitida.</p>
            </div>
          `;
          container.querySelector("#checkout-tentar-novamente")?.addEventListener("click", () => renderView());
          return;
        }

        container.innerHTML = `
          <div style="text-align: center; padding: 64px 0;">
            <div style="width:64px; height:64px; background:var(--cor-sucesso); color:#fff; font-size:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 16px auto;">✓</div>
            <h2>Pedido Recebido com Sucesso!</h2>
            <p class="texto-sec" style="margin-bottom: 24px;">Obrigado, <strong>${escapeHtml(nome)}</strong>. Seu pedido foi registrado com o total validado pelo servidor de <strong>${formatBRL(pedidoConfirmado?.valor_total)}</strong>. Nossa equipe entrará em contato em breve via WhatsApp.</p>
            ${perfilFoiSalvo ? '<p class="checkout-profile-status success">Seus dados foram salvos na sua conta para as próximas compras.</p>' : ''}
            ${falhaAoSalvarPerfil ? '<p class="checkout-profile-status warning">O pedido foi registrado, mas não foi possível salvar os dados na conta. Você pode tentar novamente em Perfil / Conta.</p>' : ''}
            <a href="index.html" class="btn btn-primario btn-lg">Voltar para a Página Inicial</a>
          </div>
        `;

        cart.clearCart();
      });
    }

    // Pré-preenchimento inteligente dos dados da conta se usuário estiver logado
    (async () => {
      try {
        const { obterUsuarioAtual, obterPerfilUsuario } = await import('../supabase.js');
        const user = await obterUsuarioAtual();
        const saveBox = document.getElementById("checkout-save-profile");
        const saveCheckbox = document.getElementById("check-salvar-perfil");
        const saveHelp = document.getElementById("checkout-save-profile-help");
        if (saveBox) saveBox.style.display = "block";
        if (saveCheckbox) saveCheckbox.disabled = !user;
        if (saveHelp) {
          saveHelp.innerHTML = user
            ? "Opcional: marque a caixa para guardar os dados desta compra no seu perfil."
            : 'Entre na sua conta para salvar seus dados: <a href="login.html">fazer login ou cadastro</a>.';
        }

        if (user) {
          const perfil = await obterPerfilUsuario(user.id);
          const meta = user.user_metadata || {};
          const nomeEl = document.getElementById("check-nome");
          const emailEl = document.getElementById("check-email");
          const telEl = document.getElementById("check-tel");
          const cpfEl = document.getElementById("check-cpf");
          const ruaEl = document.getElementById("check-rua");
          const cepEl = document.getElementById("check-cep");

          if (nomeEl && (perfil?.nome || meta.nome || meta.full_name)) {
            nomeEl.value = perfil?.nome || meta.nome || meta.full_name;
          }
          if (emailEl && (perfil?.email || user.email)) {
            emailEl.value = perfil?.email || user.email;
          }
          if (telEl && perfil?.telefone) telEl.value = perfil.telefone;
          if (cpfEl && perfil?.cpf) cpfEl.value = formatCpfCnpj(perfil.cpf);
          if (ruaEl && perfil?.endereco) ruaEl.value = perfil.endereco;
          if (cepEl && perfil?.cep) cepEl.value = perfil.cep;
        }
      } catch (e) {
        // Ignora silenciosamente se offline ou local
      }
    })();
  }

  renderView();
}
