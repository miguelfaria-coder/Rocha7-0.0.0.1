-- Limitação de tentativas do checkout. Os IPs são armazenados somente como HMAC.
-- Esta migração não altera public.mensagens_contato.
CREATE TABLE IF NOT EXISTS public.rocha7_checkout_rate_limits (
  ip_hash text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);
CREATE INDEX IF NOT EXISTS rocha7_checkout_rate_limits_updated_at_idx
  ON public.rocha7_checkout_rate_limits(updated_at);
ALTER TABLE public.rocha7_checkout_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.rocha7_checkout_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rocha7_checkout_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.rocha7_checkout_allow_request(p_ip_hash text)
RETURNS boolean LANGUAGE plpgsql SET search_path = ''
AS $function$
DECLARE v_count integer;
BEGIN
  IF p_ip_hash IS NULL OR p_ip_hash !~ '^[a-f0-9]{64}$' THEN RETURN false; END IF;
  DELETE FROM public.rocha7_checkout_rate_limits
  WHERE updated_at < pg_catalog.now() - interval '24 hours';

  INSERT INTO public.rocha7_checkout_rate_limits AS current_window
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
