alter table public.pedidos
  add column if not exists provedor_pagamento text,
  add column if not exists mercadopago_preference_id text,
  add column if not exists mercadopago_payment_id text,
  add column if not exists mercadopago_payment_method text;

alter table public.pedidos
  drop constraint if exists pedidos_provedor_pagamento_check;
alter table public.pedidos
  add constraint pedidos_provedor_pagamento_check
  check (provedor_pagamento is null or provedor_pagamento in ('stripe', 'mercadopago'));

create unique index if not exists pedidos_mercadopago_preference_id_uidx
  on public.pedidos (mercadopago_preference_id)
  where mercadopago_preference_id is not null;
create unique index if not exists pedidos_mercadopago_payment_id_uidx
  on public.pedidos (mercadopago_payment_id)
  where mercadopago_payment_id is not null;
