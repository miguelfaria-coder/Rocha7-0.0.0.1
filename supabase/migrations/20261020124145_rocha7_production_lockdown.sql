-- Apply only after the frontend calling rocha7-create-order and rocha7-contact-message
-- is deployed to production and its successful response paths are confirmed.
BEGIN;

-- Orders may be created only through the server-side transactional checkout function.
REVOKE ALL PRIVILEGES ON TABLE public.pedidos, public.itens_pedido FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.pedidos, public.itens_pedido TO authenticated;
DROP POLICY IF EXISTS "Visitantes e usuarios criam pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Visitantes e usuarios criam itens do pedido" ON public.itens_pedido;

-- Contact data is accepted only by the validated, rate-limited Edge Function.
REVOKE ALL PRIVILEGES ON TABLE public.mensagens_contato FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "Permitir envio de mensagens de contato" ON public.mensagens_contato;
DROP POLICY IF EXISTS "Visitantes enviam mensagem de contato" ON public.mensagens_contato;
DROP POLICY IF EXISTS "Leitura restrita a administradores" ON public.mensagens_contato;
CREATE POLICY "Deny direct client access to contact messages"
  ON public.mensagens_contato AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Role/status changes are administrative and happen only through trusted backend access.
DROP POLICY IF EXISTS "Usuario atualiza seu proprio perfil" ON public.perfis;

-- No public RPC execution for a legacy trigger helper.
REVOKE EXECUTE ON FUNCTION public.rocha7_atualizar_usuario_updated_at()
  FROM PUBLIC, anon, authenticated;

COMMIT;
