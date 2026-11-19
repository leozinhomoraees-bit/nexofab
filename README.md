# NexoFab

SaaS multiempresa para orçamentos, precificação, produção, estoque e financeiro.

## Isolamento do projeto

- Use somente um projeto Supabase novo e vazio.
- Nunca copie `.env`, chaves, usuários, Storage, dumps ou dados de outra instalação.
- O formulário público permanece desabilitado até que o tenant seja resolvido explicitamente por domínio ou slug.
- A migration `202611180001_nexofab_multitenancy_foundation.sql` recusa bancos com registros operacionais sem organização.

## Desenvolvimento local

1. Crie um projeto Supabase exclusivo para o NexoFab.
2. Copie `.env.example` para `.env.local` e informe somente a URL e a chave pública do projeto novo.
3. Aplique todas as migrations, em ordem, no banco vazio.
4. Crie um usuário em **Authentication > Users**.
5. Autenticado como esse usuário, chame `public.create_organization('Minha empresa')` por um cliente que preserve a sessão, ou implemente a tela de onboarding antes do piloto.
6. Rode `npm ci` e `npm run dev`.

## Publicação

Conecte este repositório a um projeto Vercel novo. Configure as variáveis de ambiente separadamente para Development, Preview e Production. Não vincule o projeto Vercel anterior.

## Modelo de segurança

- Todas as tabelas operacionais possuem `organization_id NOT NULL`.
- O tenant ativo é validado por membership ativa, nunca pela primeira empresa cadastrada.
- RLS restringe leitura e escrita ao tenant ativo.
- Uploads usam o prefixo `<organization_id>/...`.
- Papéis pertencem ao vínculo usuário–organização.
- A chave `service_role` não é necessária para executar a aplicação atual.

## Antes do primeiro cliente

- Implementar onboarding e convites na interface.
- Escolher o provedor de cobrança e processar webhooks idempotentes.
- Criar testes automatizados com dois tenants para RLS, RPCs e Storage.
- Habilitar o formulário público somente após definir tenant por domínio ou slug e aplicar rate limiting.
