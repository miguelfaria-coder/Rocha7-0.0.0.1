-- Restore only the column privileges needed for authenticated users to manage their own profiles.
-- Keep Row Level Security enabled and preserve the immutable signup-method column.
GRANT INSERT (
  id, email, nome, cpf, telefone, cep, endereco,
  numero, complemento, bairro, cidade, estado, avatar_url
) ON TABLE public.usuarios TO authenticated;

GRANT UPDATE (
  id, email, nome, cpf, telefone, cep, endereco,
  numero, complemento, bairro, cidade, estado, avatar_url
) ON TABLE public.usuarios TO authenticated;
