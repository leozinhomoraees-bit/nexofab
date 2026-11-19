# Testes de isolamento

Execute somente contra um Supabase local descartável, depois de aplicar todas as migrations:

```sh
supabase test db
```

`tenant_isolation.sql` cria dois tenants e dois usuários dentro de uma transação, verifica criação automática do contexto, leitura cruzada, tentativa de insert cruzado e troca indevida de organização. Tudo é revertido ao final.
