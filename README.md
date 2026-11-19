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
5. Entre em `/login`; o onboarding cria a primeira empresa e define o tenant ativo.
6. Em **Gestão > Equipe**, gere convites para os demais usuários. O link é exibido uma única vez e deve ser enviado por um canal confiável.
7. Rode `npm ci` e `npm run dev`.

## Verificações

```sh
npm run lint
npm run build
supabase test db
```

O teste SQL deve ser executado apenas em um Supabase local descartável. Ele cria dois tenants dentro de uma transação e confirma que leitura, escrita e troca de empresa não atravessam a fronteira de RLS.

## Publicação

Conecte este repositório a um projeto Vercel novo. Configure as variáveis de ambiente separadamente para Development, Preview e Production. Não vincule o projeto Vercel anterior.

## Modelo de segurança

- Todas as tabelas operacionais possuem `organization_id NOT NULL`.
- O tenant ativo é validado por membership ativa, nunca pela primeira empresa cadastrada.
- RLS restringe leitura e escrita ao tenant ativo.
- Uploads usam o prefixo `<organization_id>/...`.
- Papéis pertencem ao vínculo usuário–organização.
- Convites armazenam apenas o hash do token e exigem o mesmo e-mail autenticado.
- Criação, aceite e revogação de convites passam por RPCs `security definer` restritas ao papel `authenticated`.
- A chave `service_role` não é necessária para executar a aplicação atual.

## Antes do primeiro cliente

- Escolher o provedor de cobrança e processar webhooks idempotentes.
- Ampliar os testes locais para cobrir expiração de convites e políticas do Storage.
- Habilitar o formulário público somente após definir tenant por domínio ou slug e aplicar rate limiting.
