-- Rocha7: perfis de clientes e integração de pedidos.
-- Deliberadamente não altera public.mensagens_contato nem public.contato.

CREATE TABLE IF NOT EXISTS public.usuarios (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  nome text NOT NULL DEFAULT '',
  cpf varchar(14),
  telefone varchar(20),
  cep varchar(9),
  endereco text,
  numero varchar(20),
  complemento text,
  bairro text,
  cidade text,
  estado varchar(2),
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.usuarios TO authenticated;

DROP POLICY IF EXISTS "Rocha7: usuario le proprio cadastro" ON public.usuarios;
DROP POLICY IF EXISTS "Rocha7: usuario cria proprio cadastro" ON public.usuarios;
DROP POLICY IF EXISTS "Rocha7: usuario atualiza proprio cadastro" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_select_own" ON public.usuarios;
CREATE POLICY "usuarios_select_own" ON public.usuarios
  FOR SELECT TO authenticated USING ((select auth.uid()) = id);
DROP POLICY IF EXISTS "usuarios_insert_own" ON public.usuarios;
CREATE POLICY "usuarios_insert_own" ON public.usuarios
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = id);
DROP POLICY IF EXISTS "usuarios_update_own" ON public.usuarios;
CREATE POLICY "usuarios_update_own" ON public.usuarios
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

CREATE OR REPLACE FUNCTION public.rocha7_set_usuarios_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rocha7_usuarios_updated_at ON public.usuarios;
CREATE TRIGGER rocha7_usuarios_updated_at
BEFORE UPDATE ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION public.rocha7_set_usuarios_updated_at();

CREATE OR REPLACE FUNCTION public.rocha7_handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.usuarios (id, email, nome, telefone, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data ->> 'nome',
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(COALESCE(NEW.email, ''), '@', 1)
    ),
    NEW.raw_user_meta_data ->> 'telefone',
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    nome = CASE WHEN public.usuarios.nome = '' THEN EXCLUDED.nome ELSE public.usuarios.nome END,
    telefone = COALESCE(public.usuarios.telefone, EXCLUDED.telefone),
    avatar_url = COALESCE(public.usuarios.avatar_url, EXCLUDED.avatar_url),
    updated_at = now();
  RETURN NEW;
END;
$$;

-- Evita dois triggers gravando o mesmo perfil quando uma instalação anterior já existe.
DROP TRIGGER IF EXISTS rocha7_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.rocha7_criar_perfil_auth();

DROP TRIGGER IF EXISTS rocha7_on_auth_user_created ON auth.users;
CREATE TRIGGER rocha7_on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.rocha7_handle_new_auth_user();

REVOKE EXECUTE ON FUNCTION public.rocha7_handle_new_auth_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rocha7_set_usuarios_updated_at() FROM PUBLIC, anon, authenticated;

INSERT INTO public.usuarios (id, email, nome, telefone, avatar_url)
SELECT
  u.id,
  COALESCE(u.email, ''),
  COALESCE(
    u.raw_user_meta_data ->> 'nome',
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name',
    split_part(COALESCE(u.email, ''), '@', 1)
  ),
  u.raw_user_meta_data ->> 'telefone',
  COALESCE(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS cpf_cliente varchar(20);

GRANT SELECT ON public.produtos, public.categorias TO anon, authenticated;
GRANT SELECT, INSERT ON public.pedidos TO anon, authenticated;
GRANT SELECT, INSERT ON public.itens_pedido TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.designs_salvos TO authenticated;
