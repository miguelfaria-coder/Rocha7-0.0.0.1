# Stripe no Rocha7 — ambiente de testes

Esta implementação aceita somente a chave secreta de teste do Stripe (sk_test_...). Não configure uma chave sk_live_... nesta etapa.

## 1. Aplicar a migração

Aplique o arquivo supabase/migrations/20261020150000_rocha7_stripe_test_checkout.sql ao projeto Supabase de desenvolvimento/teste. Ele adiciona campos exclusivos para o estado do pagamento; o campo pedidos.status continua sendo o fluxo operacional do pedido.

## 2. Configurar segredos no Supabase

No Supabase Dashboard, abra Edge Functions → Secrets e configure:
- STRIPE_SECRET_KEY: chave secreta de teste do Stripe (sk_test_...).
- STRIPE_WEBHOOK_SECRET: segredo de assinatura de um endpoint webhook de teste (whsec_...).

Esses valores não devem ser enviados ao navegador, adicionados a arquivos HTML/JavaScript ou commitados no GitHub. As funções usam as credenciais do Supabase injetadas pelo ambiente e leem as credenciais Stripe por variáveis de ambiente.

## 3. Publicar as Edge Functions

Publique:
- rocha7-stripe-checkout
- rocha7-stripe-webhook

A configuração supabase/config.toml desativa a validação JWT do gateway para essas duas funções: a primeira suporta checkout de visitante e valida a chave de idempotência do pedido; a segunda precisa receber chamadas do Stripe. A função webhook autentica a requisição pela assinatura Stripe.

## 4. Configurar o webhook no Stripe em modo de teste

Crie um endpoint apontando para:

https://tqixpmfpqegxkfwqxasa.supabase.co/functions/v1/rocha7-stripe-webhook

Selecione os eventos:
- checkout.session.completed
- checkout.session.async_payment_succeeded
- checkout.session.async_payment_failed
- checkout.session.expired

Copie o segredo de assinatura do endpoint de teste (whsec_...) para o segredo STRIPE_WEBHOOK_SECRET do projeto Supabase de teste. Um segredo obtido de outro endpoint ou ambiente não funciona.

## 5. Cartão e Pix

A função cria sessões Checkout em BRL e deixa payment_method_types a cargo dos métodos dinâmicos da conta Stripe. Isso evita solicitar Pix explicitamente quando ele não está habilitado. Para usar Pix, habilite-o em Stripe Dashboard → Settings → Payment methods e confirme a elegibilidade da conta. O Pix da Stripe no Brasil é para pagamentos únicos em BRL; sua disponibilidade depende da conta e da configuração do método.

## 6. Teste de ponta a ponta

1. Use somente o ambiente de teste do Stripe e dados de cartão de teste publicados pela Stripe.
2. Confirme que o navegador é redirecionado a checkout.stripe.com.
3. Complete um pagamento de teste e confirme no banco que pagamento_status só muda para pago após o webhook assinado.
4. Teste cancelamento e pagamentos assíncronos: retornar à página do site não é prova de pagamento.
5. Verifique os logs de Edge Functions se a assinatura ou a atualização no banco falhar.

## Segurança importante

- A URL de retorno nunca marca o pedido como pago.
- O webhook valida assinatura, tolerância temporal, ambiente de teste, moeda BRL, ID do pedido, ID da sessão e valor total salvo no banco.
- Sessões antigas/substituídas são ignoradas quando não correspondem à sessão atual do pedido.
- A chave Stripe usada no servidor deve permanecer sk_test_... até que uma etapa explícita de preparação para produção seja concluída.
