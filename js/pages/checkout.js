/* checkout.js - Script do Processo de Finalização de Compra */
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { cart } from '../cart.js';
import { escapeHtml, formatBRL } from '../utils.js';

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

            <div style="display:grid; grid-template-columns: 2fr 1fr; gap:16px; margin-bottom: 16px;">
              <div class="form-group">
                <label class="form-label">Endereço de Entrega</label>
                <input type="text" class="form-input" id="check-rua" placeholder="Rua, número, bairro..." required>
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
        const formaPagamento = document.getElementById("check-pagamento")?.value || "pix";

        const dadosPedido = {
          nome,
          email,
          telefone,
          endereco,
          cep,
          formaPagamento,
          tipoPedido: 'varejo',
          valorTotal: summary.valorTotal
        };

        try {
          const { criarPedidoSupabase } = await import('../supabase.js');
          await criarPedidoSupabase(dadosPedido, summary.items);
          console.log("Pedido salvo com sucesso no Supabase!");
        } catch (err) {
          console.warn("Aviso ao salvar pedido no Supabase (pedido registrado localmente):", err.message || err);
        }

        container.innerHTML = `
          <div style="text-align: center; padding: 64px 0;">
            <div style="width:64px; height:64px; background:var(--cor-sucesso); color:#fff; font-size:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 16px auto;">✓</div>
            <h2>Pedido Recebido com Sucesso!</h2>
            <p class="texto-sec" style="margin-bottom: 24px;">Obrigado, <strong>${escapeHtml(nome)}</strong>. Seu pedido foi registrado. Nossa equipe entrará em contato em breve via WhatsApp.</p>
            <a href="index.html" class="btn btn-primario btn-lg">Voltar para a Página Inicial</a>
          </div>
        `;

        cart.clearCart();
      });
    }
  }

  renderView();
}
