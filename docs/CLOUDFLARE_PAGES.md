# Cloudflare Pages — produção

## Build settings do projeto `rocha7`

- Root directory: vazio (raiz do repositório)
- Build command: `bash scripts/build-pages.sh`
- Build output directory: `dist`
- Production branch: `main`

O script publica somente os arquivos estáticos necessários ao site: páginas HTML, `css/`, `js/`, `assets/`, `logo.png`, `_headers` e `_redirects`. Não publicar a raiz inteira do repositório.

## Arquitetura de produção

- Cloudflare Pages: hospedagem do frontend estático em `https://rocha7.devs.surf`.
- Supabase Auth/PostgreSQL/Edge Functions: backend e dados continuam no projeto Supabase `tqixpmfpqegxkfwqxasa`.
- O navegador usa somente a chave publicável do Supabase.
- Segredos de serviço, Stripe e Mercado Pago permanecem nas variáveis secretas das Edge Functions do Supabase; nunca cadastrar essas chaves no Pages ou no JavaScript do navegador.

## Auth e CORS

O Site URL do Supabase Auth deve ser `https://rocha7.devs.surf`. Manter o hostname Pages e o domínio Vercel somente como origens de fallback/preview enquanto forem necessários. As Edge Functions de navegador precisam autorizar explicitamente o domínio de produção e o hostname Pages; não usar curingas para todos os previews.

## Banco de dados e histórico

A hospedagem do frontend não migra nem substitui o banco. O PostgreSQL permanece no Supabase. Antes de executar qualquer alteração de schema, reconciliar os arquivos de `supabase/migrations/` com o histórico aplicado no banco: o projeto registra 14 migrações aplicadas, enquanto o diretório versionado atualmente contém apenas 5 arquivos. Não reaplicar versões já executadas nem criar migrações retroativas com os mesmos identificadores.

## Validação pós-deploy

1. Confirmar que o build e deploy do Pages terminaram com sucesso.
2. Testar login/cadastro Google, sessão, perfil e leitura de produtos.
3. Enviar uma mensagem de contato e confirmar a gravação em `public.mensagens_contato`.
4. Criar um pedido de teste e confirmar o registro de pedido/itens sem alterar pagamentos reais.
5. Testar as operações administrativas com uma conta cujo papel esteja ativo.
6. Validar webhooks e pagamentos em ambiente de teste antes de habilitar cobrança real.

O checkout atual registra o pedido e mostra a confirmação de recebimento; a chamada do frontend ainda não inicia o Stripe Checkout nem o checkout do Mercado Pago. As funções de pagamento e as rotas de retorno devem ser integradas/testadas separadamente antes de considerar pagamentos online prontos.
