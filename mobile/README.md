# Rocha7 para Android e iOS

App em React Native com Expo, conectado ao mesmo projeto Supabase do site Rocha7.

## O que já compartilha com o site

- Catálogo e preços consultados na tabela `produtos` do Supabase.
- Login e cadastro usando o Auth do mesmo projeto; a mesma conta funciona nos dois clientes.
- Sessão do app persistida no dispositivo.
- Atalhos para abrir o produto, perfil, pedidos e checkout no site.

O checkout de pedidos continua no site neste primeiro corte. O app não cria pedidos por conta própria.

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
