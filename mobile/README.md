# Rocha7 para Android e iOS

App em React Native com Expo, conectado ao mesmo projeto Supabase do site Rocha7. O site continua funcionando normalmente; este app oferece fluxos nativos próprios para os clientes.

## Fluxos disponíveis no app

- Home, catálogo, busca, categorias e destaques carregados do Supabase.
- Tela nativa de produto com cor, modelagem, tamanho e quantidade.
- Sacola persistente no dispositivo e pedido em lote com mínimo de 10 peças.
- Checkout nativo, salvamento opcional de perfil e criação segura do pedido pelo backend existente.
- Login por e-mail ou Google, cadastro, edição de perfil, consulta de pedidos e formulário de contato.
- Pagamento aberto em uma aba segura do sistema; o retorno automático por deep link usa a página `pagamento-retorno.html` e a função Stripe atualizada neste repositório. Os dados de cartão são tratados pela Stripe.

O app tem um editor nativo simples para texto, cor e posição da estampa. A visualização 3D avançada do site ainda não foi portada; clientes podem descrever outros pedidos de arte pelo atendimento nativo.

Para o retorno automático de pagamento funcionar em produção, publique também os arquivos atualizados do site e a função `rocha7-stripe-checkout`.

No Supabase Auth, inclua `rocha7://auth-callback` na lista de URLs de redirecionamento permitidas para habilitar o login Google no app.

## Executar

Com Node.js LTS instalado, nesta pasta rode:

```bash
npm.cmd install
npx.cmd expo start
```

Abra o QR code com Expo Go ou execute em um emulador Android/iOS. As dependências estão registradas em `package-lock.json`.

## Compartilhamento de dados

O arquivo `lib/supabase.js` aponta para a mesma URL e chave publishable que `../js/supabase.js`. Essa chave é pública por design e não concede privilégios de administrador; nunca substitua por `service_role`. A segurança de dados depende das políticas RLS já configuradas no Supabase.

As sessões são compartilhadas por identidade (mesmo usuário, senha e dados no servidor), não por armazenamento local: o login realizado no app não mantém automaticamente o navegador conectado, e vice-versa.
