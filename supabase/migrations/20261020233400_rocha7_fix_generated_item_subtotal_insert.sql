-- Keep the secure order RPC compatible with itens_pedido.subtotal, which is a generated column.
BEGIN;

CREATE OR REPLACE FUNCTION public.rocha7_create_order_secure(p_order jsonb, p_items jsonb, p_user_id uuid, p_idempotency_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
  v_total numeric(12,2);
  v_old_total numeric(12,2);
  v_name text;
  v_email text;
  v_phone text;
  v_cpf text;
  v_address text;
  v_cep text;
  v_payment text;
  v_order_type text;
  v_qty integer;
  v_item jsonb;
  v_digits text;
BEGIN
  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Chave da tentativa inválida' USING ERRCODE = '22023';
  END IF;

  SELECT id, valor_total INTO v_id, v_old_total
  FROM public.pedidos
  WHERE idempotencia_id = p_idempotency_key
    AND usuario_id IS NOT DISTINCT FROM p_user_id;
  IF FOUND THEN
    RETURN pg_catalog.jsonb_build_object('id', v_id, 'valor_total', v_old_total, 'repetido', true);
  END IF;

  IF p_order IS NULL OR pg_catalog.jsonb_typeof(p_order) <> 'object'
     OR p_items IS NULL OR pg_catalog.jsonb_typeof(p_items) <> 'array'
     OR pg_catalog.jsonb_array_length(p_items) < 1
     OR pg_catalog.jsonb_array_length(p_items) > 30 THEN
    RAISE EXCEPTION 'Dados do pedido inválidos' USING ERRCODE = '22023';
  END IF;

  v_name := pg_catalog.btrim(COALESCE(p_order ->> 'nome', ''));
  v_email := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_order ->> 'email', '')));
  v_phone := pg_catalog.btrim(COALESCE(p_order ->> 'telefone', ''));
  v_cpf := pg_catalog.btrim(COALESCE(p_order ->> 'cpf', ''));
  v_address := pg_catalog.btrim(COALESCE(p_order ->> 'endereco', ''));
  v_cep := pg_catalog.btrim(COALESCE(p_order ->> 'cep', ''));
  v_payment := COALESCE(p_order ->> 'formaPagamento', 'pix');
  v_order_type := COALESCE(p_order ->> 'tipoPedido', 'varejo');

  IF pg_catalog.char_length(v_name) NOT BETWEEN 3 AND 150
     OR pg_catalog.char_length(v_email) > 254
     OR v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
     OR v_payment NOT IN ('pix', 'boleto', 'cartao')
     OR v_order_type NOT IN ('varejo', 'lote')
     OR pg_catalog.char_length(v_address) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'Dados do pedido inválidos' USING ERRCODE = '22023';
  END IF;

  v_digits := pg_catalog.regexp_replace(v_phone, '[^0-9]', '', 'g');
  IF pg_catalog.char_length(v_digits) NOT BETWEEN 8 AND 15 THEN
    RAISE EXCEPTION 'Telefone inválido' USING ERRCODE = '22023';
  END IF;
  v_digits := pg_catalog.regexp_replace(v_cpf, '[^0-9]', '', 'g');
  IF pg_catalog.char_length(v_digits) NOT IN (11, 14) THEN
    RAISE EXCEPTION 'CPF/CNPJ inválido' USING ERRCODE = '22023';
  END IF;
  v_digits := pg_catalog.regexp_replace(v_cep, '[^0-9]', '', 'g');
  IF pg_catalog.char_length(v_digits) <> 8 THEN
    RAISE EXCEPTION 'CEP inválido' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT e.value FROM pg_catalog.jsonb_array_elements(p_items) AS e(value)
  LOOP
    IF pg_catalog.jsonb_typeof(v_item) <> 'object'
       OR COALESCE(v_item ->> 'id', '') = ''
       OR COALESCE(v_item ->> 'tamanho', '') = ''
       OR COALESCE(v_item ->> 'cor', '') = ''
       OR COALESCE(v_item ->> 'quantidade', '') !~ '^[0-9]{1,4}$' THEN
      RAISE EXCEPTION 'Item inválido' USING ERRCODE = '22023';
    END IF;
    v_qty := (v_item ->> 'quantidade')::integer;
    IF v_qty NOT BETWEEN 1 AND 500
       OR NOT EXISTS (SELECT 1 FROM public.produtos p WHERE p.id = v_item ->> 'id') THEN
      RAISE EXCEPTION 'Produto ou quantidade inválidos' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- Preço de catálogo + custo fixo de personalização; preço recebido do navegador é ignorado.
  WITH raw_items AS (
    SELECT e.value ->> 'id' AS produto_id,
           e.value ->> 'tamanho' AS tamanho,
           e.value ->> 'cor' AS cor,
           (e.value ->> 'quantidade')::integer AS quantidade,
           CASE WHEN pg_catalog.jsonb_typeof(e.value -> 'customDesign') = 'object'
                THEN e.value -> 'customDesign' ELSE NULL END AS design
    FROM pg_catalog.jsonb_array_elements(p_items) AS e(value)
  ), grouped AS (
    SELECT r.*, p.nome AS nome_produto, p.preco_base, p.tipo_personalizacao,
      SUM(r.quantidade) OVER (
        PARTITION BY r.produto_id,
          CASE WHEN p.tipo_personalizacao = 'personalizavel'
               THEN COALESCE(r.design, 'null'::jsonb) ELSE 'null'::jsonb END
      ) AS group_qty
    FROM raw_items r JOIN public.produtos p ON p.id = r.produto_id
  ), priced AS (
    SELECT *, pg_catalog.round(preco_base +
      CASE WHEN tipo_personalizacao = 'personalizavel'
           THEN 60.00 / GREATEST(group_qty, 1) ELSE 0 END, 2) AS unit_price
    FROM grouped
  )
  SELECT pg_catalog.round(SUM(quantidade * unit_price), 2) INTO v_total FROM priced;

  IF v_total IS NULL OR v_total <= 0 OR v_total > 250000 THEN
    RAISE EXCEPTION 'Total calculado fora do limite' USING ERRCODE = '22023';
  END IF;

  -- A função inteira roda em uma transação; erro nos itens reverte o pedido pai.
  INSERT INTO public.pedidos (
    usuario_id, nome_cliente, email_cliente, telefone_whatsapp, cpf_cliente,
    endereco_entrega, cep, forma_pagamento, tipo_pedido, valor_total,
    observacoes, idempotencia_id
  )
  VALUES (
    p_user_id, v_name, v_email, v_phone, v_cpf, v_address, v_cep,
    v_payment, v_order_type, v_total,
    NULLIF(pg_catalog.btrim(COALESCE(p_order ->> 'observacoes', '')), ''),
    p_idempotency_key
  )
  RETURNING id INTO v_id;

  WITH raw_items AS (
    SELECT e.value ->> 'id' AS produto_id,
           e.value ->> 'tamanho' AS tamanho,
           e.value ->> 'cor' AS cor,
           (e.value ->> 'quantidade')::integer AS quantidade,
           CASE WHEN pg_catalog.jsonb_typeof(e.value -> 'customDesign') = 'object'
                THEN e.value -> 'customDesign' ELSE NULL END AS design
    FROM pg_catalog.jsonb_array_elements(p_items) AS e(value)
  ), grouped AS (
    SELECT r.*, p.nome AS nome_produto, p.preco_base, p.tipo_personalizacao,
      SUM(r.quantidade) OVER (
        PARTITION BY r.produto_id,
          CASE WHEN p.tipo_personalizacao = 'personalizavel'
               THEN COALESCE(r.design, 'null'::jsonb) ELSE 'null'::jsonb END
      ) AS group_qty
    FROM raw_items r JOIN public.produtos p ON p.id = r.produto_id
  ), priced AS (
    SELECT *, pg_catalog.round(preco_base +
      CASE WHEN tipo_personalizacao = 'personalizavel'
           THEN 60.00 / GREATEST(group_qty, 1) ELSE 0 END, 2) AS unit_price
    FROM grouped
  )
  INSERT INTO public.itens_pedido (
    pedido_id, produto_id, nome_produto, tamanho, cor, quantidade,
    preco_unitario, detalhes_design
  )
  SELECT v_id, produto_id, nome_produto, tamanho, cor, quantidade,
         unit_price, design
  FROM priced;

  RETURN pg_catalog.jsonb_build_object('id', v_id, 'valor_total', v_total, 'repetido', false);
END;
$function$

COMMIT;
