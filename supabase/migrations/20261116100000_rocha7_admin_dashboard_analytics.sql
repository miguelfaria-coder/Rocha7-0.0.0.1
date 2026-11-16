CREATE INDEX IF NOT EXISTS idx_pedidos_criado_em
  ON public.pedidos (criado_em);

CREATE INDEX IF NOT EXISTS idx_itens_pedido_pedido_id
  ON public.itens_pedido (pedido_id);

CREATE OR REPLACE FUNCTION public.rocha7_admin_dashboard_analytics(
  p_start date,
  p_end date,
  p_granularity text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
  v_result jsonb;
BEGIN
  IF p_start IS NULL OR p_end IS NULL OR p_end < p_start OR p_end - p_start > 1826 THEN
    RAISE EXCEPTION 'Invalid analytics date range' USING ERRCODE = '22023';
  END IF;
  IF p_granularity NOT IN ('day', 'month') THEN
    RAISE EXCEPTION 'Invalid analytics granularity' USING ERRCODE = '22023';
  END IF;

  v_start := p_start::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_end := (p_end + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo';

  WITH eligible_orders AS (
    SELECT p.id, p.criado_em, p.status, p.valor_total
    FROM public.pedidos AS p
    WHERE p.criado_em >= v_start
      AND p.criado_em < v_end
      AND p.status IN ('confirmado', 'em_producao', 'enviado', 'concluido', 'entregue')
  ),
  all_orders AS (
    SELECT p.id, p.criado_em, p.status
    FROM public.pedidos AS p
    WHERE p.criado_em >= v_start AND p.criado_em < v_end
  ),
  date_series AS (
    SELECT bucket
    FROM pg_catalog.generate_series(
      pg_catalog.date_trunc(p_granularity, p_start::timestamp),
      pg_catalog.date_trunc(p_granularity, p_end::timestamp),
      CASE WHEN p_granularity = 'month' THEN interval '1 month' ELSE interval '1 day' END
    ) AS gs(bucket)
  ),
  order_counts AS (
    SELECT pg_catalog.date_trunc(p_granularity, o.criado_em AT TIME ZONE 'America/Sao_Paulo') AS bucket,
      pg_catalog.count(*) AS order_count
    FROM all_orders AS o
    GROUP BY 1
  ),
  summary AS (
    SELECT pg_catalog.count(*) AS orders,
      COALESCE(pg_catalog.sum(o.valor_total), 0) AS revenue,
      COALESCE(pg_catalog.avg(o.valor_total), 0) AS average_ticket
    FROM eligible_orders AS o
  ),
  status_totals AS (
    SELECT COALESCE(
      pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('status', s.status, 'orders', s.orders) ORDER BY s.orders DESC, s.status),
      '[]'::jsonb
    ) AS data
    FROM (
      SELECT o.status, pg_catalog.count(*) AS orders
      FROM all_orders AS o
      GROUP BY o.status
    ) AS s
  ),
  top_products AS (
    SELECT COALESCE(
      pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'productId', p.produto_id::text,
        'name', p.nome_produto,
        'quantity', p.quantity
      ) ORDER BY p.quantity DESC, p.nome_produto),
      '[]'::jsonb
    ) AS data
    FROM (
      SELECT i.produto_id, i.nome_produto, pg_catalog.sum(i.quantidade) AS quantity
      FROM public.itens_pedido AS i
      INNER JOIN eligible_orders AS o ON o.id = i.pedido_id
      GROUP BY i.produto_id, i.nome_produto
      ORDER BY pg_catalog.sum(i.quantidade) DESC, i.nome_produto
      LIMIT 8
    ) AS p
  )
  SELECT pg_catalog.jsonb_build_object(
    'revenue', summary.revenue,
    'averageTicket', summary.average_ticket,
    'revenueOrders', summary.orders,
    'totalOrders', (SELECT pg_catalog.count(*) FROM all_orders),
    'series', COALESCE((
      SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'period', pg_catalog.to_char(ds.bucket, CASE WHEN p_granularity = 'month' THEN 'YYYY-MM' ELSE 'YYYY-MM-DD' END),
        'orders', COALESCE(oc.order_count, 0)
      ) ORDER BY ds.bucket)
      FROM date_series AS ds
      LEFT JOIN order_counts AS oc USING (bucket)
    ), '[]'::jsonb),
    'statuses', status_totals.data,
    'topProducts', top_products.data
  )
  INTO v_result
  FROM summary CROSS JOIN status_totals CROSS JOIN top_products;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.rocha7_admin_dashboard_analytics(date, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rocha7_admin_dashboard_analytics(date, date, text) TO service_role;
