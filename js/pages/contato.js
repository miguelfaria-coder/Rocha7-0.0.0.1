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
        const { enviarMensagemContatoSupabase, obterUsuarioAtual } = await import('../supabase.js');
        const usuario = await obterUsuarioAtual().catch(() => null);

        await enviarMensagemContatoSupabase({
          nome,
          email,
          telefone,
          mensagem,
          usuarioId: usuario?.id || null
        });

        cart.showToast(
          `Obrigado, ${nome}! Sua mensagem foi enviada com sucesso. Nossa equipe entrará em contato.`,
          "sucesso"
        );
        // Limpa os campos após confirmação
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

    // Pré-preenchimento automático dos dados se o usuário estiver logado
    (async () => {
      try {
        const { obterUsuarioAtual, obterPerfilUsuario } = await import('../supabase.js');
        const user = await obterUsuarioAtual();
        if (user) {
          const perfil = await obterPerfilUsuario(user.id);
          const meta = user.user_metadata || {};
          const nomeEl = document.getElementById("contato-nome");
          const emailEl = document.getElementById("contato-email");
          const telEl = document.getElementById("contato-tel");

          if (nomeEl && (perfil?.nome || meta.nome || meta.full_name)) {
            nomeEl.value = perfil?.nome || meta.nome || meta.full_name;
          }
          if (emailEl && (perfil?.email || user.email)) {
            emailEl.value = perfil?.email || user.email;
          }
          if (telEl && perfil?.telefone) {
            telEl.value = perfil.telefone;
          }
        } else {
          const localUser = localStorage.getItem('r7_user');
          if (localUser) {
            const parsed = JSON.parse(localUser);
            if (document.getElementById("contato-nome") && parsed.nome) document.getElementById("contato-nome").value = parsed.nome;
            if (document.getElementById("contato-email") && parsed.email) document.getElementById("contato-email").value = parsed.email;
          }
        }
      } catch (e) {
        // silencioso
      }
    })();
  }
});
