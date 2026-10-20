# Mercado Pago no Rocha7 — ambiente de testes

O checkout usa Mercado Pago Checkout Pro em BRL. A chave privada fica somente nos Supabase Edge Function Secrets. O retorno do navegador nunca confirma o pagamento; somente o webhook assinado pode alterar o pedido para pago.

## 1. Credenciais de teste

No painel [Mercado Pago Developers](https://www.mercadopago.com.br/developers/panel), abra ou crie a aplicação Rocha7 e copie as credenciais de teste. Para testar a compra, também é necessário um usuário de teste comprador; use esse usuário ao entrar no checkout do Mercado Pago.

No Supabase Dashboard do projeto `tqixpmfpqegxkfwqxasa`, abra Edge Functions → Secrets e configure:

- `MERCADOPAGO_ACCESS_TOKEN`: Access Token de teste da aplicação.
- `MERCADOPAGO_WEBHOOK_SECRET`: chave secreta de assinatura gerada para o webhook de pagamentos da aplicação.
- `ROCHA7_SITE_URL`: opcional; origem HTTPS exata do preview Vercel que você vai testar, sem caminho nem barra final. Sem isso, usa `https://rocha7.vercel.app`.

Não envie esses valores por chat, não os coloque no navegador e não faça commit deles.

## 2. Webhook

Na aplicação Mercado Pago, configure notificações Webhooks para o evento de pagamentos, apontando para:

`https://tqixpmfpqegxkfwqxasa.supabase.co/functions/v1/rocha7-mercadopago-webhook`

Copie a chave secreta criada para esse webhook em `MERCADOPAGO_WEBHOOK_SECRET`. A URL e a chave precisam pertencer à mesma configuração de webhook. O endpoint consulta o pagamento diretamente na API e valida assinatura, preferência associada ao pedido, moeda e valor antes de atualizar o banco.

Para uma compra de teste, o Mercado Pago pode exigir que você simule uma notificação pelo painel de desenvolvedores; o retorno ao site sozinho não confirma pagamento.

## 3. Fluxo implementado

1. O site cria o pedido pelo endpoint seguro já existente.
2. A Edge Function calcula o total usando os itens salvos no banco e cria a preferência Checkout Pro.
3. O cliente é redirecionado para o `init_point` da preferência. Com credenciais de teste e usuário comprador de teste, o pagamento permanece no ambiente de testes.
4. O webhook consulta o pagamento e só confirma o pedido quando o status é aprovado e o total em BRL confere.
5. A página `pagamento.html` consulta apenas o status salvo no banco.

## 4. Banco e dados anteriores

A migração `20261020234947_rocha7_mercadopago_checkout_test.sql` adiciona IDs e método do Mercado Pago. Ela preserva os campos e pedidos antigos do Stripe para manter histórico, inclusive o pedido de teste já confirmado. Novos pedidos iniciados pelo checkout passam a usar Mercado Pago.

## 5. Teste

1. Configure os dois segredos de teste e o webhook no Mercado Pago e no Supabase.
2. Abra o preview da branch no Vercel e faça um pedido de baixo valor usando o usuário comprador de teste do Mercado Pago.
3. Conclua o pagamento no Checkout Pro e confirme a notificação no painel/logs do Mercado Pago.
4. Verifique no Supabase que `pagamento_status` mudou para `pago` após a validação do webhook.

A documentação oficial do [Checkout Pro e criação de preferências](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/overview) e de [contas de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/test-accounts) explica como criar credenciais e usuários de teste.
