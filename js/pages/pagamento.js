import { renderHeader } from "../components/header.js";
import { renderFooter } from "../components/footer.js";
import { cart } from "../cart.js";
import { obterStatusPagamentoStripe } from "../supabase.js";

const container = document.getElementById("payment-status-container");
const params = new URLSearchParams(window.location.search);
const sessionId = params.get("session_id");
const state = params.get("estado");

document.addEventListener("DOMContentLoaded", () => {
  renderHeader();
  renderFooter();
});

function render(title, message, extraHtml = "") {
  if (!container) return;
  container.innerHTML =
    "<h1>" + title + "</h1>" +
    '<p class="texto-sec" style="margin:16px auto 28px;max-width:600px;">' + message + "</p>" +
    extraHtml;
}

function checkoutLink(label = "Voltar ao checkout") {
  return '<a class="btn btn-primario btn-lg" href="checkout.html">' + label + "</a>";
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkPayment(maxAttempts = 15) {
  if (!sessionId || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
    render("Não foi possível verificar o pagamento", "O link de confirmação está incompleto ou inválido.", checkoutLink());
    return;
  }

  render("Verificando o pagamento", "Aguardando a confirmação autenticada do Stripe. Não feche a página.");

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await obterStatusPagamentoStripe(sessionId);
      if (result.status === "pago") {
        cart.clearCart();
        try { localStorage.removeItem("rocha7_checkout_attempt_v1"); } catch {}
        render(
          "Pagamento confirmado",
          "O Stripe confirmou o pagamento do seu pedido. A equipe Rocha7 poderá dar continuidade ao atendimento.",
          '<a class="btn btn-primario btn-lg" href="index.html">Voltar para a página inicial</a>'
        );
        return;
      }

      if (result.status === "falhou" || result.status === "estornado") {
        render(
          "Pagamento não confirmado",
          "O pagamento não foi concluído. Seus itens continuam no carrinho; retorne ao checkout para tentar novamente.",
          checkoutLink("Tentar novamente")
        );
        return;
      }
    } catch (error) {
      console.warn("Ainda não foi possível consultar o status do pagamento.");
    }

    if (attempt < maxAttempts - 1) await wait(2000);
  }

  render(
    "Pagamento em processamento",
    "Ainda não recebemos a confirmação final. Não faça outro pagamento por enquanto. Você pode verificar novamente ou voltar depois.",
    '<button class="btn btn-primario btn-lg" id="payment-check-again" type="button">Verificar novamente</button>'
  );
  container.querySelector("#payment-check-again")?.addEventListener("click", () => checkPayment(15));
}

if (state === "cancelado") {
  render(
    "Pagamento cancelado",
    "O pagamento foi cancelado no Stripe. O pedido não foi marcado como pago e os itens continuam no carrinho.",
    checkoutLink("Retomar checkout")
  );
} else {
  void checkPayment();
}
