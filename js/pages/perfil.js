/* perfil.js — Gerenciamento de dados da conta */
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { obterUsuarioAtual, obterPerfilUsuario, atualizarPerfilUsuario } from '../supabase.js';

document.addEventListener('DOMContentLoaded', () => {
  renderHeader();
  renderFooter();
  initPerfil();
});

async function initPerfil() {
  const container = document.getElementById('perfil-content');
  if (!container) return;

  let usuario;
  let perfil;
  try {
    usuario = await obterUsuarioAtual();
    if (!usuario) {
      container.innerHTML = `
        <section class="profile-login-required">
          <h2>Entre na sua conta</h2>
          <p>Para consultar e alterar seu CPF, telefone e endereço de entrega, primeiro entre ou crie uma conta Rocha7.</p>
          <a class="btn btn-primario btn-lg" href="login.html">Entrar ou cadastrar</a>
        </section>`;
      return;
    }
    perfil = await obterPerfilUsuario(usuario.id);
  } catch (error) {
    container.innerHTML = '<div class="profile-login-required">Não foi possível carregar sua conta. Atualize a página e tente novamente.</div>';
    return;
  }

  const metadata = usuario.user_metadata || {};
  const nomeInicial = perfil?.nome || metadata.nome || metadata.full_name || metadata.name || '';
  const emailInicial = perfil?.email || usuario.email || '';
  container.innerHTML = `
    <form class="profile-card" id="form-perfil" novalidate>
      <div class="profile-section-heading">
        <h2>Dados pessoais e para pedidos</h2>
        <p>Essas informações podem ser usadas para preencher o checkout. Você pode salvar apenas o que souber agora e completar depois.</p>
      </div>
      <div id="profile-alert" aria-live="polite"></div>
      <div class="profile-form-grid">
        <div class="profile-field">
          <label for="profile-name">Nome completo / organização</label>
          <input id="profile-name" name="nome" type="text" maxlength="150" autocomplete="name" value="${escapeAttribute(nomeInicial)}" required>
        </div>
        <div class="profile-field">
          <label for="profile-email">E-mail para pedidos</label>
          <input id="profile-email" name="email" type="email" maxlength="254" autocomplete="email" value="${escapeAttribute(emailInicial)}" required>
          <small>Usado nas confirmações de compra. Alterá-lo aqui não muda o e-mail de acesso à conta.</small>
        </div>
        <div class="profile-field">
          <label for="profile-phone">WhatsApp / telefone</label>
          <input id="profile-phone" name="telefone" type="tel" maxlength="30" autocomplete="tel" placeholder="(11) 99999-9999" value="${escapeAttribute(perfil?.telefone || '')}">
        </div>
        <div class="profile-field">
          <label for="profile-cpf">CPF ou CNPJ</label>
          <input id="profile-cpf" name="cpf" type="text" maxlength="18" inputmode="numeric" autocomplete="off" placeholder="000.000.000-00" aria-describedby="profile-cpf-help" value="${escapeAttribute(perfil?.cpf || '')}">
          <small>Informe CPF (11 dígitos) ou CNPJ (14 dígitos), se já tiver essa informação.</small>
        </div>
        <div class="profile-field full">
          <label for="profile-address">Rua / Avenida</label>
          <input id="profile-address" name="endereco" type="text" maxlength="500" autocomplete="address-line1" placeholder="Nome da rua ou avenida" value="${escapeAttribute(perfil?.endereco || '')}">
        </div>
        <div class="profile-field">
          <label for="profile-numero">Número</label>
          <input id="profile-numero" name="numero" type="text" maxlength="30" autocomplete="address-line2" placeholder="Número do imóvel" value="${escapeAttribute(perfil?.numero || '')}">
        </div>
        <div class="profile-field">
          <label for="profile-complemento">Complemento</label>
          <input id="profile-complemento" name="complemento" type="text" maxlength="120" placeholder="Apartamento, bloco, referência (opcional)" value="${escapeAttribute(perfil?.complemento || '')}">
        </div>
        <div class="profile-field">
          <label for="profile-bairro">Bairro</label>
          <input id="profile-bairro" name="bairro" type="text" maxlength="120" autocomplete="address-level3" placeholder="Seu bairro" value="${escapeAttribute(perfil?.bairro || '')}">
        </div>
        <div class="profile-field">
          <label for="profile-cidade">Cidade</label>
          <input id="profile-cidade" name="cidade" type="text" maxlength="120" autocomplete="address-level2" placeholder="Sua cidade" value="${escapeAttribute(perfil?.cidade || '')}">
        </div>
        <div class="profile-field">
          <label for="profile-estado">Estado (UF)</label>
          <input id="profile-estado" name="estado" type="text" maxlength="2" minlength="2" autocomplete="address-level1" placeholder="SP" autocapitalize="characters" value="${escapeAttribute(perfil?.estado || '')}">
        </div>
        <div class="profile-field">
          <label for="profile-cep">CEP</label>
          <input id="profile-cep" name="cep" type="text" maxlength="12" inputmode="numeric" autocomplete="postal-code" placeholder="00000-000" value="${escapeAttribute(perfil?.cep || '')}">
        </div>
      </div>
      <div class="profile-form-actions">
        <p>Seus dados são vinculados à sua conta e não ficam visíveis para outros clientes.</p>
        <button class="btn btn-primario btn-lg" id="btn-salvar-perfil" type="submit">Salvar alterações</button>
      </div>
    </form>`;

  const form = container.querySelector('#form-perfil');
  const submit = container.querySelector('#btn-salvar-perfil');
  const alert = container.querySelector('#profile-alert');
  const stateInput = container.querySelector('#profile-estado');
  stateInput?.addEventListener('input', () => {
    stateInput.value = stateInput.value.replace(/[^a-z]/gi, '').slice(0, 2).toUpperCase();
  });

  const cpfInput = container.querySelector('#profile-cpf');
  if (cpfInput) {
    cpfInput.value = formatCpfCnpj(cpfInput.value);
    cpfInput.addEventListener('input', () => {
      const cursor = cpfInput.selectionStart ?? cpfInput.value.length;
      const digitsBeforeCursor = cpfInput.value.slice(0, cursor).replace(/\D/g, '').length;
      cpfInput.value = formatCpfCnpj(cpfInput.value);
      let newCursor = 0;
      let seenDigits = 0;
      while (newCursor < cpfInput.value.length && seenDigits < digitsBeforeCursor) {
        if (/\d/.test(cpfInput.value[newCursor])) seenDigits++;
        newCursor++;
      }
      while (/[.\/-]/.test(cpfInput.value[newCursor] || '') && newCursor < cpfInput.value.length) newCursor++;
      cpfInput.setSelectionRange(newCursor, newCursor);
    });
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const nome = valueOf('profile-name');
    const email = valueOf('profile-email');
    const telefone = valueOf('profile-phone');
    const cpf = valueOf('profile-cpf');
    const endereco = valueOf('profile-address');
    const numero = valueOf('profile-numero');
    const complemento = valueOf('profile-complemento');
    const bairro = valueOf('profile-bairro');
    const cidade = valueOf('profile-cidade');
    const estado = valueOf('profile-estado').toUpperCase();
    const cep = valueOf('profile-cep');
    const cpfDigits = cpf.replace(/\D/g, '');
    const cepDigits = cep.replace(/\D/g, '');

    if (nome.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showAlert('Informe seu nome e um e-mail válido para os pedidos.', 'error');
      return;
    }
    if (cpf && ![11, 14].includes(cpfDigits.length)) {
      showAlert('O CPF deve ter 11 dígitos ou o CNPJ deve ter 14 dígitos.', 'error');
      return;
    }
    if (estado && !/^[A-Z]{2}$/.test(estado)) {
      showAlert('Informe a sigla de 2 letras do estado, por exemplo SP.', 'error');
      return;
    }
    if (cep && cepDigits.length !== 8) {
      showAlert('O CEP deve conter 8 dígitos.', 'error');
      return;
    }

    const originalText = submit?.textContent || 'Salvar alterações';
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Salvando...';
    }
    if (alert) alert.innerHTML = '';

    try {
      await atualizarPerfilUsuario(usuario.id, {
        nome, email,
        telefone: telefone || null,
        cpf: cpf || null,
        endereco: endereco || null,
        numero: numero || null,
        complemento: complemento || null,
        bairro: bairro || null,
        cidade: cidade || null,
        estado: estado || null,
        cep: cep || null
      });

      // Atualiza o nome no balão da conta assim que o perfil é salvo.
      const localUser = {
        id: usuario.id,
        nome,
        email: email || usuario.email || ""
      };
      localStorage.setItem("r7_user", JSON.stringify(localUser));
      window.dispatchEvent(new Event("user-state-changed"));

      showAlert('Perfil atualizado. Os dados salvos serão usados para preencher suas próximas compras.', 'success');
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      showAlert(error?.message || 'Não foi possível salvar os dados. Verifique sua conexão e tente novamente.', 'error');
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = originalText;
      }
    }
  });

  function valueOf(id) {
    return document.getElementById(id)?.value.trim() || '';
  }
  function showAlert(message, type) {
    if (!alert) return;
    alert.className = `profile-alert ${type}`;
    alert.textContent = message;
  }
}

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

function escapeAttribute(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}
