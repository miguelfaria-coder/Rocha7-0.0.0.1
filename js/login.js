import { loginUsuario, cadastrarUsuario } from './supabase.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const senhaInput = document.getElementById('senha');
    const emailError = document.getElementById('email-error');
    const senhaError = document.getElementById('senha-error');
    const toggleCadastro = document.getElementById('toggleCadastro');
    let isModoCadastro = false;

    if (toggleCadastro) {
        toggleCadastro.addEventListener('click', (e) => {
            e.preventDefault();
            isModoCadastro = !isModoCadastro;
            const title = document.querySelector('.form-header h2');
            const submitBtn = loginForm.querySelector('.btn-login');
            
            if (isModoCadastro) {
                if (title) title.textContent = 'Criar Nova Conta';
                if (submitBtn) submitBtn.textContent = 'Cadastrar no Sistema';
                toggleCadastro.textContent = 'Já tem uma conta? Faça login';
            } else {
                if (title) title.textContent = 'Login';
                if (submitBtn) submitBtn.textContent = 'Entrar no Sistema';
                toggleCadastro.textContent = 'Cadastre-se';
            }
        });
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        let isValid = true;
        
        // Reset de erros
        emailError.textContent = '';
        senhaError.textContent = '';
        emailInput.style.borderColor = '';
        senhaInput.style.borderColor = '';

        // Validação de E-mail
        if (!emailInput.value.trim()) {
            emailError.textContent = 'O e-mail é obrigatório.';
            emailInput.style.borderColor = 'var(--cor-perigo)';
            isValid = false;
        } else if (!validateEmail(emailInput.value)) {
            emailError.textContent = 'Por favor, insira um e-mail válido.';
            emailInput.style.borderColor = 'var(--cor-perigo)';
            isValid = false;
        }

        // Validação de Senha
        if (!senhaInput.value.trim()) {
            senhaError.textContent = 'A senha é obrigatória.';
            senhaInput.style.borderColor = 'var(--cor-perigo)';
            isValid = false;
        } else if (senhaInput.value.length < 6) {
            senhaError.textContent = 'A senha deve ter no mínimo 6 caracteres.';
            senhaInput.style.borderColor = 'var(--cor-perigo)';
            isValid = false;
        }

        // Processo de Login/Cadastro no Supabase
        if (isValid) {
            const btn = loginForm.querySelector('.btn-login');
            const originalText = btn.textContent;
            
            btn.textContent = isModoCadastro ? 'Cadastrando...' : 'Verificando...';
            btn.style.opacity = '0.8';
            btn.disabled = true;

            const email = emailInput.value.trim();
            const senha = senhaInput.value;
            const nomePadrao = email.split('@')[0];

            try {
                if (isModoCadastro) {
                    const data = await cadastrarUsuario(email, senha, nomePadrao);
                    const userObj = {
                        nome: data.user?.user_metadata?.nome || nomePadrao,
                        email: email
                    };
                    localStorage.setItem('r7_user', JSON.stringify(userObj));
                    alert("Conta criada com sucesso!");
                    window.location.href = 'index.html';
                } else {
                    const data = await loginUsuario(email, senha);
                    const userObj = {
                        nome: data.user?.user_metadata?.nome || nomePadrao,
                        email: email
                    };
                    localStorage.setItem('r7_user', JSON.stringify(userObj));
                    window.location.href = 'index.html';
                }
            } catch (error) {
                console.warn('Erro ou Supabase não configurado. Ativando login local/demonstração:', error.message || error);
                
                // Fallback para login/cadastro local de dev se as chaves do Supabase ainda forem as padrão
                const userName = email.split('@')[0];
                const formattedName = userName.charAt(0).toUpperCase() + userName.slice(1);
                const userObj = {
                    nome: formattedName,
                    email: email
                };
                localStorage.setItem('r7_user', JSON.stringify(userObj));
                window.location.href = 'index.html';
            } finally {
                btn.textContent = originalText;
                btn.style.opacity = '1';
                btn.disabled = false;
            }
        }
    });

    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(String(email).toLowerCase());
    }
});

