-- Stripe test/live Checkout tracking for Rocha7.
-- Secrets stay in Supabase Edge Function environment variables, never in SQL or frontend code.
alter table public.pedidos
  add column if not exists status_pagamento text not null default 'nao_iniciado',
  add column if not exists stripe_session_id text,
  add column if not exists stripe_payment_intent text;

create unique index if not exists pedidos_stripe_session_id_unique
  on public.pedidos (stripe_session_id)
  where stripe_session_id is not null;

create index if not exists pedidos_status_pagamento_idx
  on public.pedidos (status_pagamento);

alter table public.pedidos
  drop constraint if exists pedidos_status_pagamento_check;

alter table public.pedidos
  add constraint pedidos_status_pagamento_check
  check (status_pagamento in ('nao_iniciado', 'pendente', 'pago', 'falhou', 'expirado'));
