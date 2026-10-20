-- Keep internal logs and throttling tables outside the exposed API schema.
BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

DO $$
BEGIN
  IF to_regclass('public.log_acessos') IS NOT NULL
     AND to_regclass('private.log_acessos') IS NULL THEN
    ALTER TABLE public.log_acessos SET SCHEMA private;
  END IF;
END;
$$;

REVOKE ALL PRIVILEGES ON TABLE
  private.log_acessos,
  private.rocha7_checkout_rate_limits,
  private.rocha7_contact_rate_limits
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  private.log_acessos,
  private.rocha7_checkout_rate_limits,
  private.rocha7_contact_rate_limits
TO service_role;

-- Explicit service-role policies document the only intended database access path.
-- service_role also has BYPASSRLS, so these policies are defense-in-depth documentation.
DROP POLICY IF EXISTS "Service role manages internal access logs" ON private.log_acessos;
CREATE POLICY "Service role manages internal access logs"
  ON private.log_acessos FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages checkout rate limits" ON private.rocha7_checkout_rate_limits;
CREATE POLICY "Service role manages checkout rate limits"
  ON private.rocha7_checkout_rate_limits FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages contact rate limits" ON private.rocha7_contact_rate_limits;
CREATE POLICY "Service role manages contact rate limits"
  ON private.rocha7_contact_rate_limits FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMIT;
