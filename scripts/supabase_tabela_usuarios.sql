-- ==============================================================================
-- AGÊNCIA ROCHA7 - TABELA DE USUÁRIOS E PERFIS COM SUPORTE A GOOGLE AUTH & COMPRAS
-- ==============================================================================
-- Execute todo este script no Supabase SQL Editor (SQL Editor -> New Query -> Run)
-- ==============================================================================

-- 1. Criação da tabela de perfis de usuários (public.usuarios)
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    cpf VARCHAR(14),                     -- Formato: 000.000.000-00 ou só dígitos
    telefone VARCHAR(20),                -- WhatsApp / Celular: (XX) 9XXXX-XXXX
    cep VARCHAR(9),                      -- CEP: 00000-000
    endereco TEXT,                       -- Rua / Avenida / Logradouro
    numero VARCHAR(20),                  -- Número da residência ou S/N
    complemento TEXT,                    -- Apto, Bloco, etc.
    bairro TEXT,                         -- Bairro
    cidade TEXT,                         -- Cidade
    estado VARCHAR(2),                   -- UF: SP, RJ, etc.
    avatar_url TEXT,                     -- Foto de perfil (preenchida via Google)
    tipo_usuario VARCHAR(20) DEFAULT 'cliente', -- 'cliente' ou 'admin'
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar Row Level Security (RLS)
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Segurança (RLS)
-- Qualquer usuário autenticado pode ver apenas o próprio perfil
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON public.usuarios;
CREATE POLICY "Usuários podem ver seu próprio perfil"
ON public.usuarios
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Qualquer usuário autenticado pode atualizar apenas seus próprios dados (CPF, endereço, etc.)
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON public.usuarios;
CREATE POLICY "Usuários podem atualizar seu próprio perfil"
ON public.usuarios
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Permitir inserção pelo próprio usuário ou trigger
DROP POLICY IF EXISTS "Usuários podem inserir seu perfil" ON public.usuarios;
CREATE POLICY "Usuários podem inserir seu perfil"
ON public.usuarios
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- 4. Função e Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_usuarios_updated_at ON public.usuarios;
CREATE TRIGGER trigger_set_usuarios_updated_at
BEFORE UPDATE ON public.usuarios
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- 5. Função de Gatilho para criação automática de usuário após Cadastro ou Login com Google
-- Captura nome, email e avatar fornecidos pelo Google OAuth ou cadastro de email/senha
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    nome_usuario TEXT;
    avatar_usuario TEXT;
    telefone_usuario TEXT;
BEGIN
    -- Captura nome do metadata (funciona com Google OAuth e cadastro do site)
    nome_usuario := COALESCE(
        NEW.raw_user_meta_data->>'nome',
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
    );

    -- Captura avatar (Google OAuth fornece picture/avatar_url)
    avatar_usuario := COALESCE(
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.raw_user_meta_data->>'picture',
        NULL
    );

    -- Captura telefone se enviado no cadastro
    telefone_usuario := NEW.raw_user_meta_data->>'telefone';

    -- Insere ou atualiza na tabela pública
    INSERT INTO public.usuarios (
        id,
        email,
        nome,
        avatar_url,
        telefone,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        NEW.email,
        nome_usuario,
        avatar_usuario,
        telefone_usuario,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        nome = COALESCE(public.usuarios.nome, EXCLUDED.nome),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.usuarios.avatar_url),
        updated_at = timezone('utc'::text, now());

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger que dispara após novo usuário em auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- 7. (Opcional) Garantir coluna de CPF na tabela de pedidos se já existir
ALTER TABLE IF EXISTS public.pedidos ADD COLUMN IF NOT EXISTS cpf_cliente VARCHAR(20);

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

