import { loginUsuario, cadastrarUsuario, loginComGoogle } from './supabase.js';

document.addEventListener('DOMContentLoaded', () => {
    // ============================================================
    // TOGGLE ANIMAÇÃO: Login ↔ Cadastro (Card Slide)
    // ============================================================
    const card = document.querySelector(".card");
    const loginButton = document.querySelector(".LoginButton");
    const cadastroButton = document.querySelector(".CadastroButton");

    if (loginButton) {
        loginButton.addEventListener('click', () => {
            card.classList.remove("cadastroActive");
            card.classList.add("loginActive");
            limparErros('cadastro');
        });
    }

    if (cadastroButton) {
        cadastroButton.addEventListener('click', () => {
            card.classList.remove("loginActive");
            card.classList.add("cadastroActive");
            limparErros('login');
        });
    }

    // ============================================================
    // FORMULÁRIO DE LOGIN
    // ============================================================
    const loginForm = document.getElementById('loginForm');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const emailInput = document.getElementById('login-email');
            const senhaInput = document.getElementById('login-senha');
            const emailError = document.getElementById('login-email-error');
            const senhaError = document.getElementById('login-senha-error');
            const submitBtn = document.getElementById('btn-login-submit');

            // Reset de erros
            limparErros('login');

            let isValid = true;

            // Validação de E-mail
            if (!emailInput.value.trim()) {
                emailError.textContent = 'O e-mail é obrigatório.';
                isValid = false;
            } else if (!validarEmail(emailInput.value)) {
                emailError.textContent = 'Por favor, insira um e-mail válido.';
                isValid = false;
            }

            // Validação de Senha
            if (!senhaInput.value.trim()) {
                senhaError.textContent = 'A senha é obrigatória.';
                isValid = false;
            } else if (senhaInput.value.length < 6) {
                senhaError.textContent = 'A senha deve ter no mínimo 6 caracteres.';
                isValid = false;
            }

            if (!isValid) return;

            // Desabilitar botão e mostrar loading
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Verificando...';
            submitBtn.disabled = true;

            const email = emailInput.value.trim();
            const senha = senhaInput.value;
            const nomePadrao = email.split('@')[0];

            try {
                const data = await loginUsuario(email, senha);
                if (!data?.session?.user || !data?.user) {
                    throw new Error('Não foi possível validar a sessão. Tente entrar novamente.');
                }
                const userObj = {
                    id: data.user.id,
                    nome: data.user.user_metadata?.nome || data.user.user_metadata?.full_name || nomePadrao,
                    email: data.user.email || email
                };
                localStorage.setItem('r7_user', JSON.stringify(userObj));
                window.location.href = 'index.html';

            } catch (error) {
                const msg = error?.message || String(error);
                console.warn('Erro no login:', msg);

                // Não autenticar localmente quando o servidor estiver indisponível:
                // isso criaria uma sessão falsa e permitiria acesso sem validar a senha.
                if (/não configurado|not configured|Failed to fetch|NetworkError/i.test(msg)) {
                    mostrarAlerta('login', 'Não foi possível conectar ao serviço de autenticação. Verifique sua conexão e tente novamente.', 'error');
                } else {
                    mostrarAlerta('login', 'E-mail ou senha incorretos. Tente novamente.', 'error');
                }
            } finally {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    // ============================================================
    // FORMULÁRIO DE CADASTRO
    // ============================================================
    const cadastroForm = document.getElementById('cadastroForm');

    if (cadastroForm) {
        cadastroForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const nomeInput = document.getElementById('cadastro-nome');
            const emailInput = document.getElementById('cadastro-email');
            const senhaInput = document.getElementById('cadastro-senha');
            const confirmarInput = document.getElementById('cadastro-confirmar');
            const nomeError = document.getElementById('cadastro-nome-error');
            const emailError = document.getElementById('cadastro-email-error');
            const senhaError = document.getElementById('cadastro-senha-error');
            const confirmarError = document.getElementById('cadastro-confirmar-error');
            const submitBtn = document.getElementById('btn-cadastro-submit');

            // Reset de erros
            limparErros('cadastro');

            let isValid = true;

            // Validação do Nome
            if (!nomeInput.value.trim()) {
                nomeError.textContent = 'O nome é obrigatório.';
                isValid = false;
            } else if (nomeInput.value.trim().length < 3) {
                nomeError.textContent = 'O nome deve ter no mínimo 3 caracteres.';
                isValid = false;
            }

            // Validação do E-mail
            if (!emailInput.value.trim()) {
                emailError.textContent = 'O e-mail é obrigatório.';
                isValid = false;
            } else if (!validarEmail(emailInput.value)) {
                emailError.textContent = 'Por favor, insira um e-mail válido.';
                isValid = false;
            }

            // Validação da Senha
            if (!senhaInput.value.trim()) {
                senhaError.textContent = 'A senha é obrigatória.';
                isValid = false;
            } else if (senhaInput.value.length < 6) {
                senhaError.textContent = 'A senha deve ter no mínimo 6 caracteres.';
                isValid = false;
            }

            // Validação da Confirmação de Senha
            if (!confirmarInput.value.trim()) {
                confirmarError.textContent = 'Confirme sua senha.';
                isValid = false;
            } else if (senhaInput.value !== confirmarInput.value) {
                confirmarError.textContent = 'As senhas não coincidem.';
                isValid = false;
            }

            if (!isValid) return;

            // Desabilitar botão e mostrar loading
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Cadastrando...';
            submitBtn.disabled = true;

            const nome = nomeInput.value.trim();
            const email = emailInput.value.trim();
            const senha = senhaInput.value;

            try {
                const data = await cadastrarUsuario(email, senha, nome);

                // Em projetos com confirmação por e-mail, a conta existe mas ainda não há sessão.
                if (!data?.session?.user || !data?.user) {
                    mostrarAlerta('cadastro', 'Conta criada. Verifique seu e-mail e confirme o cadastro antes de entrar.', 'success');
                    return;
                }

                const userObj = {
                    id: data.user.id,
                    nome: data.user.user_metadata?.nome || data.user.user_metadata?.full_name || nome,
                    email: data.user.email || email
                };
                localStorage.setItem('r7_user', JSON.stringify(userObj));

                mostrarAlerta('cadastro', 'Conta criada com sucesso! Redirecionando...', 'success');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);

            } catch (error) {
                const msg = error?.message || String(error);
                console.warn('Erro no cadastro:', msg);

                // Não simular cadastro bem-sucedido quando o Supabase estiver indisponível.
                if (/não configurado|not configured|Failed to fetch|NetworkError/i.test(msg)) {
                    mostrarAlerta('cadastro', 'Não foi possível conectar ao serviço de cadastro. Verifique sua conexão e tente novamente.', 'error');
                } else if (/already registered|já cadastrado|already.*exist/i.test(msg)) {
                    mostrarAlerta('cadastro', 'Este e-mail já está cadastrado. Faça login.', 'error');
                } else {
                    mostrarAlerta('cadastro', msg || 'Erro ao criar conta. Tente novamente.', 'error');
                }
            } finally {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    // ============================================================
    // LOGIN COM CONTA DO GOOGLE
    // ============================================================
    const googleLoginBtn = document.getElementById('btn-google-login');
    const googleCadastroBtn = document.getElementById('btn-google-cadastro');

    async function handleGoogleLogin(tipo) {
        try {
            mostrarAlerta(tipo, 'Conectando com o Google...', 'success');
            await loginComGoogle();
        } catch (error) {
            console.error('Erro no login com Google:', error);
            const msg = error?.message || String(error);
            if (/não configurado|not configured/i.test(msg)) {
                mostrarAlerta(tipo, 'Supabase não configurado. Verifique as credenciais no js/supabase.js', 'error');
            } else if (/provider is not enabled|unsupported provider/i.test(msg)) {
                mostrarAlerta(tipo, 'Provedor Google ainda não foi ativado no painel do Supabase.', 'error');
            } else {
                mostrarAlerta(tipo, 'Falha ao autenticar com o Google. Tente novamente.', 'error');
            }
        }
    }

    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', () => handleGoogleLogin('login'));
    }

    if (googleCadastroBtn) {
        googleCadastroBtn.addEventListener('click', () => handleGoogleLogin('cadastro'));
    }

    // ============================================================
    // FUNÇÕES AUXILIARES
    // ============================================================

    /**
     * Valida formato de e-mail
     */
    function validarEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(String(email).toLowerCase());
    }

    /**
     * Limpa todas as mensagens de erro de um formulário
     * @param {'login'|'cadastro'} tipo
     */
    function limparErros(tipo) {
        const prefixo = tipo === 'login' ? 'login' : 'cadastro';
        const campos = tipo === 'login'
            ? ['email', 'senha']
            : ['nome', 'email', 'senha', 'confirmar'];

        campos.forEach(campo => {
            const el = document.getElementById(`${prefixo}-${campo}-error`);
            if (el) el.textContent = '';
        });

        // Remover alerta geral se existir
        const alertaExistente = document.querySelector(`.login-alert[data-form="${tipo}"]`);
        if (alertaExistente) alertaExistente.remove();
    }

    /**
     * Mostra alerta de sucesso ou erro acima do formulário
     * @param {'login'|'cadastro'} tipo
     * @param {string} mensagem
     * @param {'success'|'error'} nivel
     */
    function mostrarAlerta(tipo, mensagem, nivel) {
        // Remove alerta anterior do mesmo form
        const anteriorAlert = document.querySelector(`.login-alert[data-form="${tipo}"]`);
        if (anteriorAlert) anteriorAlert.remove();

        const formEl = tipo === 'login'
            ? document.querySelector('.FormLogin')
            : document.querySelector('.FormCadastro');

        if (!formEl) return;

        const alerta = document.createElement('div');
        alerta.className = `login-alert alert-${nivel}`;
        alerta.setAttribute('data-form', tipo);
        alerta.textContent = mensagem;

        // Insere antes do form
        const form = formEl.querySelector('form');
        if (form) {
            formEl.insertBefore(alerta, form);
        } else {
            formEl.appendChild(alerta);
        }

        // Auto-remover após 6 segundos
        if (nivel === 'error') {
            setTimeout(() => {
                alerta.remove();
            }, 6000);
        }
    }
});
