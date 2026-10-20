-- Rocha7 security infrastructure. Safe to apply before the new frontend ships:
-- preserve direct checkout writes temporarily; hard lock-down is a separate post-deploy migration.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

-- Move the internal checkout rate-limit table out of the exposed public schema.
DO $$
BEGIN
  IF to_regclass('public.rocha7_checkout_rate_limits') IS NOT NULL
     AND to_regclass('private.rocha7_checkout_rate_limits') IS NULL THEN
    ALTER TABLE public.rocha7_checkout_rate_limits SET SCHEMA private;
  END IF;
END;
$$;

REVOKE ALL PRIVILEGES ON TABLE private.rocha7_checkout_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE private.rocha7_checkout_rate_limits TO service_role;
ALTER TABLE private.rocha7_checkout_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS private.rocha7_contact_rate_limits (
  ip_hash text PRIMARY KEY CHECK (ip_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);
ALTER TABLE private.rocha7_contact_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE private.rocha7_contact_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE private.rocha7_contact_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.rocha7_checkout_allow_request(p_ip_hash text)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF p_ip_hash IS NULL OR p_ip_hash !~ '^[a-f0-9]{64}$' THEN RETURN false; END IF;
  DELETE FROM private.rocha7_checkout_rate_limits
  WHERE updated_at < pg_catalog.now() - interval '24 hours';

  INSERT INTO private.rocha7_checkout_rate_limits AS current_window
    (ip_hash, window_started_at, request_count, updated_at)
  VALUES (p_ip_hash, pg_catalog.now(), 1, pg_catalog.now())
  ON CONFLICT (ip_hash) DO UPDATE
  SET window_started_at = CASE
        WHEN current_window.window_started_at <= pg_catalog.now() - interval '1 minute'
        THEN pg_catalog.now() ELSE current_window.window_started_at END,
      request_count = CASE
        WHEN current_window.window_started_at <= pg_catalog.now() - interval '1 minute'
        THEN 1 ELSE current_window.request_count + 1 END,
      updated_at = pg_catalog.now()
  RETURNING request_count INTO v_count;

  RETURN v_count <= 5;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.rocha7_checkout_allow_request(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rocha7_checkout_allow_request(text) TO service_role;

CREATE OR REPLACE FUNCTION public.rocha7_contact_allow_request(p_ip_hash text)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF p_ip_hash IS NULL OR p_ip_hash !~ '^[a-f0-9]{64}$' THEN RETURN false; END IF;

  DELETE FROM private.rocha7_contact_rate_limits
  WHERE updated_at < pg_catalog.now() - interval '48 hours';

  INSERT INTO private.rocha7_contact_rate_limits AS current_window
    (ip_hash, window_started_at, request_count, updated_at)
  VALUES (p_ip_hash, pg_catalog.now(), 1, pg_catalog.now())
  ON CONFLICT (ip_hash) DO UPDATE
  SET window_started_at = CASE
        WHEN current_window.window_started_at <= pg_catalog.now() - interval '10 minutes'
        THEN pg_catalog.now() ELSE current_window.window_started_at END,
      request_count = CASE
        WHEN current_window.window_started_at <= pg_catalog.now() - interval '10 minutes'
        THEN 1 ELSE current_window.request_count + 1 END,
      updated_at = pg_catalog.now()
  RETURNING request_count INTO v_count;

  RETURN v_count <= 5;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.rocha7_contact_allow_request(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rocha7_contact_allow_request(text) TO service_role;

-- Cover foreign-key lookup paths highlighted by the Supabase advisors.
CREATE INDEX IF NOT EXISTS idx_itens_pedido_design_customizado_id
  ON public.itens_pedido (design_customizado_id);
CREATE INDEX IF NOT EXISTS idx_itens_pedido_produto_id
  ON public.itens_pedido (produto_id);
CREATE INDEX IF NOT EXISTS idx_log_acessos_usuario_id
  ON public.log_acessos (usuario_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_contato_usuario_id
  ON public.mensagens_contato (usuario_id);
CREATE INDEX IF NOT EXISTS idx_perfis_papel_id
  ON public.perfis (papel_id);

-- Keep database order-status constraints in sync with the verified admin endpoint.
ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS pedidos_status_check;
ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_status_check
  CHECK (status = ANY (ARRAY['pendente','confirmado','em_producao','enviado','concluido','entregue','cancelado']));

-- Server-side input constraints. Existing valid contact rows are preserved.
ALTER TABLE public.mensagens_contato
  ADD CONSTRAINT mensagens_contato_nome_length_check
    CHECK (char_length(trim(nome)) BETWEEN 2 AND 150) NOT VALID,
  ADD CONSTRAINT mensagens_contato_email_check
    CHECK (char_length(trim(email)) BETWEEN 5 AND 254 AND email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') NOT VALID,
  ADD CONSTRAINT mensagens_contato_telefone_length_check
    CHECK (char_length(trim(telefone)) BETWEEN 8 AND 30) NOT VALID,
  ADD CONSTRAINT mensagens_contato_mensagem_length_check
    CHECK (char_length(trim(mensagem)) BETWEEN 1 AND 10000) NOT VALID,
  ADD CONSTRAINT mensagens_contato_status_check
    CHECK (status IS NULL OR status = ANY (ARRAY['pendente','em_atendimento','respondida','arquivada'])) NOT VALID;

ALTER TABLE public.mensagens_contato VALIDATE CONSTRAINT mensagens_contato_nome_length_check;
ALTER TABLE public.mensagens_contato VALIDATE CONSTRAINT mensagens_contato_email_check;
ALTER TABLE public.mensagens_contato VALIDATE CONSTRAINT mensagens_contato_telefone_length_check;
ALTER TABLE public.mensagens_contato VALIDATE CONSTRAINT mensagens_contato_mensagem_length_check;
ALTER TABLE public.mensagens_contato VALIDATE CONSTRAINT mensagens_contato_status_check;
