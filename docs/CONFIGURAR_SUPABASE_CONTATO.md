# Agência Rocha7 — Configuração do Formulário de Contato

## O que foi corrigido

- O site só exibe sucesso quando o Supabase confirma a inserção.
- Em caso de erro, o usuário recebe uma mensagem clara e os campos preenchidos não são apagados.
- O envio não pede a leitura dos dados inseridos (`.select()`), mantendo os dados protegidos contra consultas anônimas.
- O layout e o restante do site foram 100% preservados.

## Configurar o banco no Supabase

1. Abra o painel do Supabase do seu projeto.
2. Acesse **SQL Editor** e clique em **New query**.
3. Cole e execute o script SQL localizado em `supabase/sql/contato.sql`.
4. Abra o **Table Editor** e confirme que a tabela `mensagens_contato` foi criada.

## Testar o formulário

1. Abra `contato.html` no seu navegador.
2. Preencha e envie uma mensagem de teste.
3. No painel do Supabase, abra **Table Editor → mensagens_contato** e veja a mensagem registrada com `status = pendente` e data/hora (`criado_em`).
