-- Segurança Rocha7: permissões mínimas e funções internas.
-- Esta migração não altera public.mensagens_contato.

-- Remove privilégios excessivos, mantendo somente o acesso necessário ao site atual.
REVOKE ALL PRIVILEGES ON TABLE public.categorias, public.designs_salvos,
  public.itens_pedido, public.log_acessos, public.papeis, public.pedidos,
  public.perfis, public.produtos, public.usuarios
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.produtos, public.categorias, public.papeis
TO anon, authenticated;

-- Compatibilidade temporária com a versão pública atual do checkout.
-- A migração rocha7_checkout_lockdown será aplicada após publicar o endpoint seguro.
GRANT SELECT, INSERT ON TABLE public.pedidos, public.itens_pedido
TO anon, authenticated;

-- Clientes podem consultar somente o próprio perfil. Papel/status são controlados no servidor.
GRANT SELECT ON TABLE public.perfis TO authenticated;

-- Permite consultar e atualizar dados pessoais, mas não alterar id, e-mail ou timestamps.
GRANT SELECT ON TABLE public.usuarios TO authenticated;
GRANT UPDATE (nome, cpf, telefone, cep, endereco, numero, complemento, bairro, cidade, estado, avatar_url)
ON TABLE public.usuarios TO authenticated;

-- Designs pertencem ao usuário; as políticas RLS continuam limitando as linhas.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.designs_salvos TO authenticated;

-- Logs de autenticação são privados e não devem ser lidos ou gravados pelo navegador.
REVOKE ALL PRIVILEGES ON TABLE public.log_acessos FROM PUBLIC, anon, authenticated;

-- O perfil público legado não pode ser atualizado diretamente por clientes.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.perfis FROM PUBLIC, anon, authenticated;

-- SECURITY DEFINER do trigger de cadastro: search_path vazio e tabelas totalmente qualificadas.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.perfis (id, nome, email, telefone, papel_id)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'nome',
      pg_catalog.split_part(COALESCE(NEW.email, ''), '@', 1)
    ),
    COALESCE(NEW.email, ''),
    NEW.raw_user_meta_data ->> 'telefone',
    2
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      nome = COALESCE(EXCLUDED.nome, public.perfis.nome);

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.atualizado_em := pg_catalog.now();
  RETURN NEW;
END;
$function$;

-- Estas funções são chamadas pelos triggers/event triggers; não devem ser RPCs públicas.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rocha7_handle_new_auth_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rocha7_set_usuarios_updated_at() FROM PUBLIC, anon, authenticated;
