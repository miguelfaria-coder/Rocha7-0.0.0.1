import { renderHeader } from "../components/header.js";
import { renderFooter } from "../components/footer.js";
import { cart } from "../cart.js";
import { formatBRL } from "../utils.js";
import { getSupabaseClient } from "../supabase.js";

document.addEventListener("DOMContentLoaded", async () => {
  renderHeader();
  renderFooter();
  const title = document.getElementById("pagamento-titulo");
  const message = document.getElementById("pagamento-mensagem");
  const button = document.getElementById("pagamento-verificar");
  const sessionId = new URLSearchParams(location.search).get("session_id");

  async function verify() {
    if (!sessionId) {
      title.textContent = "Sessão de pagamento não encontrada";
      message.textContent = "Volte ao checkout ou entre em contato com a equipe.";
      button.hidden = true;
      return;
    }
    button.disabled = true;
    try {
      const client = getSupabaseClient();
      const result = await client.functions.invoke("rocha7-stripe-status", { body: { sessionId } });
      if (result.error) throw result.error;
      const data = result.data;
      if (data.status === "pago") {
        title.textContent = "Pagamento confirmado!";
        message.textContent = "Pedido #" + data.pedidoId + " confirmado. Total: " + formatBRL(data.valorTotal) + ".";
        cart.clearCart();
        button.hidden = true;
      } else if (data.status === "falhou" || data.status === "expirado") {
        title.textContent = "Pagamento não concluído";
        message.textContent = "O pagamento não foi concluído. Volte ao checkout para iniciar outra tentativa.";
        button.hidden = true;
      } else {
        title.textContent = "Pagamento em processamento";
        message.textContent = "Ainda aguardamos a confirmação do provedor. Aguarde e verifique novamente.";
      }
    } catch (e) {
      title.textContent = "Confirmação indisponível";
      message.textContent = "Não foi possível consultar o pagamento agora. Tente novamente em instantes.";
    } finally {
      if (!button.hidden) {
        button.disabled = false;
        button.textContent = "Verificar novamente";
      }
    }
  }
  button.addEventListener("click", verify);
  await verify();
});
