-- =============================================================================
-- DEPRECATEDO: NÃO EXECUTE ESTE ARQUIVO EM NENHUM AMBIENTE.
-- =============================================================================
-- A gravação de mensagens de contato deve ocorrer exclusivamente pela Edge
-- Function "rocha7-contact-message", que valida a entrada, aplica rate limit
-- e grava com credenciais de servidor.
--
-- Este script antigo concedia INSERT/ALL e acesso a sequences para anon e
-- authenticated. Executá-lo poderia reabrir gravações diretas pelo navegador
-- e enfraquecer o bloqueio aplicado em produção.
--
-- A tabela public.mensagens_contato e suas permissões são gerenciadas pelas
-- migrações versionadas do projeto. Não recrie políticas nem conceda GRANT
-- manualmente sem revisar o modelo de segurança atual.
--
-- Consulte SECURITY.md e as migrações em supabase/migrations/.
-- =============================================================================

DO $deprecated$
BEGIN
  RAISE EXCEPTION
    'Este script foi descontinuado por segurança. Use a Edge Function rocha7-contact-message e as migrações versionadas.';
END
$deprecated$;
