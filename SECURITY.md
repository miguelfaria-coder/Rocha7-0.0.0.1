# Rocha7 — Security baseline

## Proteções implantadas
- O navegador usa somente a chave publicável do Supabase; segredos/service-role ficam exclusivamente no servidor.
- Pedidos são criados pela Edge Function `rocha7-create-order`, com recálculo de preços no banco, inserção transacional e idempotência.
- Mensagens de contato passam pela Edge Function `rocha7-contact-message`, que valida os dados, aplica rate limit e deriva a identidade de uma sessão validada.
- Operações administrativas passam pela Edge Function `rocha7-admin`, que verifica o token com `auth.getUser` e confirma o papel ativo em `public.perfis`.
- Gravações diretas pelo navegador foram revogadas em `pedidos`, `itens_pedido` e `mensagens_contato`. Clientes autenticados só podem ler os próprios pedidos/itens conforme as políticas RLS.
- Logs internos e tabelas de rate limit ficam no schema não exposto `private`; o acesso é restrito ao papel de servidor.
- Todas as tabelas restantes no schema `public` têm RLS habilitado. Existem constraints server-side para validação de mensagens e status de pedidos.
- O checkout limita tentativas por janela de um minuto e o formulário de contato por janela de dez minutos; os IPs de rate limit são armazenados como HMAC, não como IP bruto.
- CORS administrativo, contato e checkout autorizam o domínio de produção Cloudflare Pages, o hostname canônico Pages e a origem Vercel legada durante a transição; o SDK do Supabase no navegador está fixado numa versão explícita.
- Cloudflare Pages publica somente o diretório `dist/`, montado por `scripts/build-pages.sh`; backend PHP legado, backups, dependências, SQL e fontes internas não entram no artefato público.
- Cabeçalhos HTTP de segurança e a rota administrativa `/admin` são configurados pelos arquivos `_headers` e `_redirects` do Pages.
- A implantação Vercel de fallback mantém suas exclusões em `.vercelignore`; no Cloudflare Pages, a exclusão é garantida pelo artefato `dist/`.

## Migrações de produção aplicadas
- `20261020123748_rocha7_private_rate_limits_and_constraints`
- `20261020124145_rocha7_production_lockdown`
- `20261020124347_rocha7_private_internal_tables`

Esses nomes/versões devem permanecer sincronizados com a tabela de histórico de migrações do Supabase. Não renomeie versões aplicadas nem execute manualmente os mesmos SQLs com novas versões. Teste alterações futuras em um branch de desenvolvimento antes de aplicá-las em produção.

## Supabase Auth — revisão manual ainda necessária
O Security Advisor ainda relata que a proteção contra senhas vazadas está desativada. Ela não é controlável pelas migrações SQL nem pelas ferramentas disponíveis nesta sessão.
1. No Dashboard Supabase, abra **Authentication → Security and Protection / Password Security**.
2. Ative **Leaked password protection**, se disponível no plano atual.
3. Configure o mínimo de 8 caracteres (12 é preferível) e regras fortes de senha.
4. Confirme o e-mail e restrinja Site URL/Redirect URLs aos domínios realmente utilizados.
5. Configure MFA para todas as contas administrativas, valide a recuperação da conta e mantenha apenas os administradores necessários.
6. Habilite CAPTCHA/anti-bot e revise limites de Auth quando disponível no plano.

## Operação e privacidade
- Nunca armazene número completo de cartão ou CVV na Rocha7; use um provedor de pagamentos adequado.
- Limite o acesso a CPF/CNPJ, endereço, telefone, pedidos e mensagens de contato.
- Não registre tokens, chaves, senhas, payloads completos ou IPs brutos em logs.
- Revise periodicamente os Security/Performance Advisors, permissões SQL, usuários administrativos, backups/PITR e retenção de dados.
- Se um segredo de servidor for exposto, revogue/rotacione-o imediatamente e audite os logs. Chaves publicáveis do Supabase podem estar no navegador; service-role/secret keys nunca podem.
