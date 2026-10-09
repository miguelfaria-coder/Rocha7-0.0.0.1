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

      const nome = document.getElementById("contato-nome")?.value.trim() || "";
      const email = document.getElementById("contato-email")?.value.trim() || "";
      const telefone = document.getElementById("contato-tel")?.value.trim() || "";
      const mensagem = document.getElementById("contato-msg")?.value.trim() || "";

      // required do HTML não impede que o visitante digite apenas espaços.
      if (!nome || !email || !telefone || !mensagem) {
        cart.showToast("Preencha todos os campos antes de enviar.", "erro");
        return;
      }

      const btnSubmit = document.getElementById("btn-submit-contato");
      const textoOriginal = btnSubmit?.textContent || "Enviar Mensagem";
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Enviando...";
      }

      try {
        const { enviarMensagemContatoSupabase } = await import('../supabase.js');
        await enviarMensagemContatoSupabase({ nome, email, telefone, mensagem });

        cart.showToast(
          `Obrigado, ${nome}! Sua mensagem foi enviada com sucesso. Nossa equipe entrará em contato.`,
          "sucesso"
        );
        // Limpa os campos apenas depois de a API confirmar a gravação.
        form.reset();
      } catch (err) {
        console.error("Erro ao salvar mensagem de contato no Supabase:", err);
        cart.showToast(
          "Não foi possível enviar sua mensagem. Verifique sua conexão e tente novamente. Seus dados foram mantidos no formulário.",
          "erro"
        );
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.textContent = textoOriginal;
        }
      }
    });
  }
});
