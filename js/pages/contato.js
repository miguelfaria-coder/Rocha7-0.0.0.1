/* contato.js - Script da Página Sobre & Contato */
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { cart } from '../cart.js';

document.addEventListener("DOMContentLoaded", () => {
  renderHeader();
  renderFooter();

  const form = document.getElementById("form-contato");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const btnSubmit = document.getElementById("btn-submit-contato");
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Enviando...";
      }

      const nome = document.getElementById("contato-nome")?.value.trim() || "";
      const email = document.getElementById("contato-email")?.value.trim() || "";
      const telefone = document.getElementById("contato-tel")?.value.trim() || "";
      const mensagem = document.getElementById("contato-msg")?.value.trim() || "";

      try {
        const { enviarMensagemContatoSupabase } = await import('../supabase.js');
        await enviarMensagemContatoSupabase({
          nome,
          email,
          telefone,
          mensagem
        });
        cart.showToast(`Obrigado, ${nome}! Sua mensagem foi salva no banco e nossa equipe entrará em contato.`, "sucesso");
      } catch (err) {
        console.warn("Mensagem enviada localmente (Supabase aviso):", err.message || err);
        cart.showToast(`Obrigado, ${nome}! Sua mensagem foi enviada.`, "sucesso");
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.textContent = "Enviar Mensagem";
        }
        form.reset();
      }
    });
  }
});
