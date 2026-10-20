-- Record how each Rocha7 account was originally registered.
-- Provider detection uses Supabase-managed raw_app_meta_data / auth.identities,
-- not user-editable raw_user_meta_data.

BEGIN;

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS metodo_cadastro text;

UPDATE public.usuarios AS u
SET metodo_cadastro = CASE
  WHEN COALESCE(au.raw_app_meta_data ->> 'provider', '') = 'google'
    OR COALESCE(au.raw_app_meta_data -> 'providers', '[]'::jsonb) @> '["google"]'::jsonb
    OR EXISTS (
      SELECT 1
      FROM auth.identities AS i
      WHERE i.user_id = u.id
        AND i.provider = 'google'
    )
  THEN 'google'
  ELSE 'email_senha'
END
FROM auth.users AS au
WHERE au.id = u.id
  AND u.metodo_cadastro IS NULL;

UPDATE public.usuarios
SET metodo_cadastro = 'email_senha'
WHERE metodo_cadastro IS NULL;

ALTER TABLE public.usuarios
  ALTER COLUMN metodo_cadastro SET DEFAULT 'email_senha',
  ALTER COLUMN metodo_cadastro SET NOT NULL;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.usuarios'::regclass
      AND conname = 'usuarios_metodo_cadastro_check'
  ) THEN
    ALTER TABLE public.usuarios
      ADD CONSTRAINT usuarios_metodo_cadastro_check
      CHECK (metodo_cadastro IN ('google', 'email_senha'));
  END IF;
END;
$migration$;

COMMENT ON COLUMN public.usuarios.metodo_cadastro IS
  'Método original de cadastro: google = Google; email_senha = cadastro por e-mail e senha.';

CREATE OR REPLACE FUNCTION public.rocha7_handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_metodo_cadastro text;
BEGIN
  v_metodo_cadastro := CASE
    WHEN COALESCE(NEW.raw_app_meta_data ->> 'provider', '') = 'google'
      OR COALESCE(NEW.raw_app_meta_data -> 'providers', '[]'::jsonb) @> '["google"]'::jsonb
      OR EXISTS (
        SELECT 1
        FROM auth.identities AS i
        WHERE i.user_id = NEW.id
          AND i.provider = 'google'
      )
    THEN 'google'
    ELSE 'email_senha'
  END;

  INSERT INTO public.usuarios (
    id, email, nome, telefone, avatar_url, metodo_cadastro
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data ->> 'nome',
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      pg_catalog.split_part(COALESCE(NEW.email, ''), '@', 1)
    ),
    NEW.raw_user_meta_data ->> 'telefone',
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture'),
    v_metodo_cadastro
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    nome = CASE
      WHEN public.usuarios.nome = '' THEN EXCLUDED.nome
      ELSE public.usuarios.nome
    END,
    telefone = COALESCE(public.usuarios.telefone, EXCLUDED.telefone),
    avatar_url = COALESCE(public.usuarios.avatar_url, EXCLUDED.avatar_url),
    metodo_cadastro = COALESCE(public.usuarios.metodo_cadastro, EXCLUDED.metodo_cadastro),
    updated_at = pg_catalog.now();

  RETURN NEW;
END;
$function$;

COMMIT;
