# Stripe Checkout em modo de teste — Rocha7

Esta integração usa o Checkout hospedado do Stripe. O valor vem do pedido já registrado e validado no Supabase; o navegador não define o valor cobrado. O pedido só recebe status `pago` após um webhook válido do Stripe.

## 1. Configurar o Stripe em modo de teste

No Dashboard do Stripe, ative **Test mode** e copie a chave secreta de teste (`sk_test_...`). Nunca use `sk_live_...` durante os testes e nunca coloque a chave em arquivos do site, no GitHub ou em variáveis `VITE_`/frontend.

## 2. Configurar os segredos no Supabase

No projeto Supabase `tqixpmfpqegxkfwqxasa`, configure os seguintes Edge Function secrets:

- `STRIPE_SECRET_KEY`: chave secreta de teste do Stripe (`sk_test_...`)
- `STRIPE_WEBHOOK_SECRET`: segredo de assinatura do endpoint de webhook (`whsec_...`)
- `ROCHA7_SITE_URL`: `https://rocha7.vercel.app`
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`: manter as variáveis de servidor já usadas pelas funções existentes.

Exemplo pela CLI do Supabase (substitua os valores localmente; não os commite):

```sh
supabase secrets set STRIPE_SECRET_KEY=sk_test_SUA_CHAVE STRIPE_WEBHOOK_SECRET=whsec_SEU_SEGREDO ROCHA7_SITE_URL=https://rocha7.vercel.app
```

## 3. Aplicar a migração e publicar as funções

Faça backup/valide o ambiente antes de aplicar a migração SQL. Depois de revisar o projeto vinculado, execute:

```sh
supabase db push
supabase functions deploy rocha7-stripe-checkout
supabase functions deploy rocha7-stripe-webhook
supabase functions deploy rocha7-stripe-status
```

A migração adiciona `status_pagamento`, `stripe_session_id` e `stripe_payment_intent` à tabela `public.pedidos`.

## 4. Configurar o webhook no Stripe

No Dashboard do Stripe em **Test mode → Developers → Webhooks**, crie um endpoint:

`https://tqixpmfpqegxkfwqxasa.supabase.co/functions/v1/rocha7-stripe-webhook`

Selecione os eventos:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

Copie o **signing secret** desse endpoint e grave como `STRIPE_WEBHOOK_SECRET` nos secrets do Supabase. O webhook valida a assinatura e confere moeda e valor contra o pedido no banco antes de marcar o pagamento como pago.

## 5. Métodos de pagamento e testes

O checkout encaminha cartão, Pix ou boleto conforme a escolha do cliente. Pix e boleto só funcionarão se estiverem habilitados e disponíveis para a conta Stripe e a configuração do país. Se um método não estiver habilitado, o Stripe poderá rejeitar a criação da sessão.

Use os dados de cartão de teste oficiais do Stripe (por exemplo, `4242 4242 4242 4242`, uma data futura e qualquer CVC de teste) somente em Test mode. Teste também cancelamento, falha, webhook e retorno pendente.

## Observações importantes

- As alterações no repositório, por si só, **não** publicam as Edge Functions nem aplicam a migração no Supabase.
- A página de retorno consulta o estado gravado pelo webhook; voltar do Stripe não é prova de pagamento.
- Não altere o status de um pedido manualmente para `pago` para simular o teste.
- Antes de produção, revisar permissões/RLS, método de cobrança, política de reembolso, notificações de pedido e fluxos de erro.
