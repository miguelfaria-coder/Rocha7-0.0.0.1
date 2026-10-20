-- Aplicar somente depois que a versão do site que chama rocha7-create-order estiver publicada.
-- A tabela public.mensagens_contato permanece completamente intocada.
REVOKE ALL PRIVILEGES ON TABLE public.pedidos, public.itens_pedido FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.pedidos, public.itens_pedido TO authenticated;
