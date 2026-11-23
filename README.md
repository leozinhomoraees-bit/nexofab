# NexoFab

SaaS multiempresa para orçamentos, precificação técnica, plano de corte, produção, aprovação de arte, estoque e financeiro.

## Isolamento do projeto

- Use somente um projeto Supabase novo, vazio e exclusivo do NexoFab.
- Nunca copie `.env`, chaves, usuários, Storage, dumps ou dados de outra instalação.
- A chave `service_role` não é utilizada pela aplicação web nem pelo processamento de webhooks.
- O endpoint genérico anônimo (`POST /api/orcamentos` sem sessão) permanece intencionalmente desabilitado (`503`); pedidos públicos ocorrem exclusivamente pelo portal opt-in de cada empresa (`/p/[slug]` → `POST /api/portal/[slug]`) com resolução explícita de tenant, antispam (honeypot + tempo mínimo) e rate limiting persistido no banco.
- A migration `202611180001_nexofab_multitenancy_foundation.sql` recusa bancos com registros operacionais sem organização.

## Desenvolvimento local

1. Crie um projeto Supabase exclusivo e vazio para o NexoFab (ative **Enable Data API** e **Enable RLS on new tables automatically**; mantenha **Grant API access to new tables automatically** desmarcado).
2. Copie `.env.example` para `.env.local` e informe apenas a URL e a Publishable/anon key do projeto novo, além das variáveis server-side do Asaas Sandbox (`ASAAS_ENVIRONMENT=sandbox`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`).
3. Aplique todas as 43 migrations em `supabase/migrations/`, em ordem cronológica.
4. Registre no banco o hash SHA-256 do `ASAAS_WEBHOOK_TOKEN` na tabela privada `private.webhook_secrets`:
   ```sql
   insert into private.webhook_secrets (provider, token_hash)
   values ('asaas', encode(extensions.digest('SEU_ASAAS_WEBHOOK_TOKEN', 'sha256'), 'hex'))
   on conflict (provider) do update set token_hash = excluded.token_hash, updated_at = now();
   ```
5. Rode `npm ci` e `npm run dev`.
6. Crie uma conta em `/cadastro` (ou em **Authentication > Users**), conclua o onboarding em `/onboarding` (inicia automaticamente o teste grátis de **7 dias** e define o usuário como `owner`) e gerencie acessos em **Gestão > Equipe**.

## Fluxos principais implementados

- **Landing page SaaS (`/`)**: apresentação dos módulos, preview interativo, planos oficiais e CTAs para `/cadastro` e `/login`.
- **Autoatendimento de conta**: `/cadastro`, `/login`, `/esqueci-senha`, `/redefinir-senha` e `/auth/callback` com proteção contra open redirect.
- **Multiempresa & Equipe**: `/onboarding`, seletor de empresa ativa (`set_active_organization`), convites por link de uso único com hash SHA-256 (`/convite/[token]`), limite de **10 usuários ativos** por empresa e gestão segura de função e suspensão/reativação via RPCs (`update_organization_member_role` e `set_organization_member_status`).
- **Assinaturas & Cobrança Asaas**:
  - Trial automático de **7 dias grátis** sem cartão ao criar organização.
  - Plano Completo nos ciclos **Mensal (R$ 29,00)**, **Trimestral (R$ 75,00 · 14% OFF)** e **Anual (R$ 240,00 · 31% OFF)** com pagamento via PIX, boleto ou cartão.
  - Checkout server-side (`POST /api/gestao/assinatura/checkout`) lendo preços exclusivamente de `public.plans`.
  - Webhook idempotente (`POST /api/billing/webhook/asaas`) validado em dupla camada (`timingSafeEqual` + hash em `private.webhook_secrets`), gravado em `billing_events` e `subscription_audit_logs`.
  - Cancelamento de renovação em autoatendimento (`POST /api/gestao/assinatura/cancelar`) mantendo acesso até o fim do período já pago.
  - Bloqueio gracioso (`402 SUBSCRIPTION_REQUIRED`) em todas as escritas operacionais após vencimento, mantendo leituras, **Minha empresa** e **Assinatura** acessíveis para regularização.
- **Portal público de orçamento (`/p/[slug]`)**: configurável em **Gestão > Minha empresa** (opt-in + slug exclusivo), com identidade da empresa, validação estrita, antispam, rate limiting persistido (`private.public_lead_rate_limits`), abertura automática de orçamento (`source = 'site'`) e notificação no sino.
- **Páginas legais**: `/termos` e `/privacidade` (LGPD).

## Verificações de qualidade

```sh
npm run lint
npx tsc --noEmit
npm run build
npm audit --omit=dev
supabase test db
```

O teste SQL (`supabase/tests/tenant_isolation.sql`, 35 asserções pgTAP) deve ser executado apenas em um Supabase local descartável — nunca diretamente em produção.

## Modelo de segurança

- Todas as tabelas operacionais possuem `organization_id NOT NULL`, `ENABLE ROW LEVEL SECURITY` e `FORCE ROW LEVEL SECURITY`, com **RBAC granular por departamento** (`owner`, `admin`, `financeiro`, `comercial`, `producao`, `estoque`) aplicado diretamente nas políticas RLS e nos buckets do Storage.
- Todas as RPCs `SECURITY DEFINER` autenticadas validam `public.current_organization_id()` e `public.has_management_role(...)`, com `search_path` fixado.
- Uploads no Storage exigem prefixo `<organization_id>/...`, bucket permitido e membership ativa.
- Papéis pertencem a `organization_members`; `owner` não pode ser rebaixado por convite nem suspenso/alterado via gestão de equipe.
- Convites armazenam apenas o hash SHA-256 do token, exigem e-mail confirmado idêntico e expiram em 7 dias.
- A aplicação web e os webhooks operam sem `service_role`.

## Checklist de Go-Live (virada para clientes reais)

1. **Domínio próprio**: conectar o domínio na Vercel e atualizar **Site URL** e **Redirect URLs** em **Authentication > URL Configuration** no Supabase.
2. **SMTP próprio + templates em português**: configurar Resend (com domínio verificado) ou Brevo em **Authentication > Emails > SMTP Settings** para sair do limite padrão do plano Free e personalizar os templates de confirmação e recuperação de senha.
3. **Asaas Produção**: criar chave de API de produção **sem permissão de saque**, cadastrar o webhook em `https://<seu-dominio>/api/billing/webhook/asaas`, atualizar `private.webhook_secrets` com o novo token e atualizar `ASAAS_ENVIRONMENT=production`, `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` na Vercel (como *Secret*), seguido de **Redeploy**.
4. **Limpeza de dados de teste**: remover organizações, convites e usuários de teste antes de liberar o acesso para clientes pagantes.
