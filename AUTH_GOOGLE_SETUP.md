# Configuração de cadastro e login com Google — Rocha7

O front-end usa Supabase Auth para login e cadastro com e-mail/senha e OAuth do Google. Os botões ficam na página `login.html` (tanto no formulário de login quanto no cadastro) e no login rápido do cabeçalho.

## 1. Criar as credenciais OAuth do Google

1. Abra o [Google Cloud Console — Google Auth Platform](https://console.cloud.google.com/auth/clients) e selecione/crie um projeto.
2. Configure Branding e Audience/consentimento. Para uma aplicação externa em modo de teste, adicione as contas de Google que farão os testes como usuários de teste. Publique a aplicação quando estiver pronta para uso geral, conforme os requisitos do Google.
3. Em Clients, crie um OAuth client ID do tipo **Web application**.
4. Em **Authorized JavaScript origins**, adicione:
   `https://rocha7.devs.surf`
   `https://rocha7-0-0-0-1.pages.dev` (Pages hostname)
   `https://rocha7.vercel.app` (fallback during migration)
5. Em **Authorized redirect URIs**, adicione o callback exibido no painel do Supabase. Para este projeto, o callback padrão é:
   `https://tqixpmfpqegxkfwqxasa.supabase.co/auth/v1/callback`
6. Salve e copie o Client ID e o Client Secret.

Referência oficial: https://supabase.com/docs/guides/auth/social-login/auth-google

## 2. Ativar Google no Supabase

1. Abra o [Supabase — Authentication Providers](https://supabase.com/dashboard/project/tqixpmfpqegxkfwqxasa/auth/providers).
2. Abra **Google**, habilite o provedor e insira o Client ID e o Client Secret gerados no Google Cloud.
3. Salve as configurações. O segredo deve ficar somente no painel/servidor do Supabase — nunca no GitHub, Vercel público ou JavaScript do navegador.

## 3. Configurar os retornos permitidos

No [Supabase — URL Configuration](https://supabase.com/dashboard/project/tqixpmfpqegxkfwqxasa/auth/url-configuration):

- **Site URL:** `https://rocha7.devs.surf`
- **Redirect URLs** (adicionar como entradas exatas):
  - `https://rocha7.devs.surf/**`
  - `https://rocha7-0-0-0-1.pages.dev/**`
  - `https://rocha7.vercel.app/**` (fallback during migration)
  - Para desenvolvimento local, se usado: `http://localhost:5500/index.html`
  - Para desenvolvimento local, se usado: `http://127.0.0.1:5500/index.html`

O código do site usa como destino primário `/index.html` na origem oficial. Em origens não autorizadas, o redirecionamento volta ao domínio oficial. As URLs permitidas do Supabase precisam corresponder aos destinos definidos no código.

## 4. Permitir novos cadastros e testar

Em **Authentication → Settings** (o nome exato pode variar na versão do painel), confirme que os novos cadastros não estão desabilitados.

Depois, teste:
1. Abra https://rocha7.devs.surf/login.html
2. Clique em **Cadastrar com o Google** e autorize uma conta Google que ainda não tenha sido cadastrada na Rocha7.
3. Confirme que a conta retorna para a página inicial e que o cabeçalho mostra o usuário conectado.
4. Saia da conta e clique em **Entrar com o Google** usando a mesma conta.
5. Repita o teste pelo botão Google do login rápido no cabeçalho.

O Supabase Auth cria o usuário na primeira autorização Google quando novos cadastros estão habilitados. Os triggers já existentes criam o perfil de cliente nas tabelas Rocha7; não atribuem papel de administrador ao novo usuário.

## Solução de problemas

- **Provider is not enabled / Unsupported provider:** o provedor Google ainda não foi habilitado/salvo no Supabase.
- **Redirect URL not allowed:** inclua a URL final exata em Authentication → URL Configuration.
- **redirect_uri_mismatch no Google:** compare a URI autorizada no Google Cloud com a URI exibida no provedor Google do Supabase; é o callback do Supabase, não `/index.html`.
- **App não verificado / acesso negado em modo de teste:** adicione a conta usada no teste à Audience/Test users ou publique a tela de consentimento conforme o fluxo indicado pelo Google.

Referência sobre retornos do Supabase: https://supabase.com/docs/guides/auth/redirect-urls
