-- Stripe test-mode checkout support for Rocha7.
-- Payment state is separate from the fulfilment/order status.
BEGIN;

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS pagamento_status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_type text,
  ADD COLUMN IF NOT EXISTS pagamento_confirmado_em timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_checkout_attempt integer NOT NULL DEFAULT 0;

ALTER TABLE public.pedidos
  DROP CONSTRAINT IF EXISTS pedidos_pagamento_status_check,
  DROP CONSTRAINT IF EXISTS pedidos_stripe_checkout_attempt_check;

ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_pagamento_status_check
    CHECK (pagamento_status = ANY (ARRAY['pendente','pago','falhou','estornado'])),
  ADD CONSTRAINT pedidos_stripe_checkout_attempt_check
    CHECK (stripe_checkout_attempt >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS pedidos_stripe_checkout_session_id_uidx
  ON public.pedidos (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pedidos_stripe_payment_intent_id_uidx
  ON public.pedidos (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS pedidos_pagamento_status_criado_idx
  ON public.pedidos (pagamento_status, criado_em DESC);

-- Client roles must never be able to alter payment state. Only trusted server code
-- using the Supabase service role may write these fields.
REVOKE UPDATE (pagamento_status, stripe_checkout_session_id,
  stripe_payment_intent_id, stripe_payment_method_type,
  pagamento_confirmado_em, stripe_checkout_attempt)
  ON TABLE public.pedidos FROM PUBLIC, anon, authenticated;

COMMENT ON COLUMN public.pedidos.pagamento_status IS
  'Estado verificado do pagamento Stripe; alterado somente pelo backend confiável.';
COMMENT ON COLUMN public.pedidos.stripe_checkout_session_id IS
  'ID da sessão Stripe Checkout atualmente associada ao pedido.';
COMMENT ON COLUMN public.pedidos.stripe_payment_method_type IS
  'Tipo efetivamente usado no pagamento (por exemplo card ou pix), quando disponível.';

COMMIT;
