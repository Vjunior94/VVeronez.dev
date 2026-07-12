# Dashboard — Agenda + Auth Multiusuário (RLS por-usuário)

**Status:** em produção desde 2026-07-11.
**Spec:** `docs/superpowers/specs/2026-07-11-agenda-dashboard-multiusuario-design.md`
**Plano:** `docs/superpowers/plans/2026-07-11-agenda-dashboard-multiusuario.md`
**Migration:** `db/migrations/002_agenda_rls_per_user.sql`

> **Leia isto antes de mexer em auth, RLS, `proxy.ts` ou em qualquer coisa sob `app/(app)/`.**
> Este banco **já sofreu um vazamento real por RLS aberta** (é para isso que a migration 001 existe).

---

## 1. O que mudou no modelo de segurança

**Antes:** o dashboard era **single-admin**. `proxy.ts` e `requireAdmin()` exigiam `is_admin` em tudo,
e a RLS de todas as tabelas era `admin_all` → na prática, `authenticated` == Valmir == admin.

**Agora:** existem **dois níveis** de usuário autenticado:

| | Valmir | Henrique |
|---|---|---|
| `public.users.is_admin` | `true` | `false` |
| `usuarios.acesso_negocio` (backend Sofia) | `true` | `false` |
| Vê leads/propostas/analytics/settings | ✅ | ❌ |
| Vê a agenda | **as duas** | **só a dele** |
| `/agenda`, `/conta` | ✅ | ✅ |

⚠️ **Consequência crítica:** `authenticated` **não é mais sinônimo de admin**. Qualquer `grant ... to
authenticated` que exista no banco agora é alcançável por um não-admin. Ao criar tabela/view nova,
**assuma que um não-admin pode tentar lê-la** e proteja com RLS.

---

## 2. A RLS é a autorização real (o `proxy.ts` é só UX)

O dashboard lê/escreve com o **browser client** (`lib/supabase/client.ts` → anon key + cookie de
sessão). Não há rotas `/api` novas nesta feature. Portanto **quem decide o que cada um enxerga é a
RLS do Postgres**, não o React.

### Peças (migration 002)

```sql
-- vínculo login <-> usuário de negócio
alter table public.usuarios add column auth_user_id uuid unique references auth.users(id);

-- resolve a usuarios.id de quem está logado (SECURITY DEFINER corta recursão de RLS)
create function public.current_usuario_id() returns uuid
  language sql stable security definer set search_path = public as $fn$
    select id from public.usuarios where auth_user_id = auth.uid();
  $fn$;
```

**Policies assimétricas** (admin vê tudo; usuário comum só o dele):

| tabela | policy |
|---|---|
| `usuarios` | SELECT: `is_admin() or auth_user_id = auth.uid()` · escrita: **admin-only** |
| `agenda_compromissos` | ALL: `is_admin() or usuario_id = current_usuario_id()` (using **e** with check) |
| `agenda_lembretes` | idem |

**Por que a escrita em `usuarios` é admin-only:** senão o Henrique poderia repontar o próprio
`auth_user_id` para a linha do Valmir → **escalação de privilégio**. Esse é o vetor sutil; está fechado.

**Fail-closed:** `current_usuario_id()` devolve `NULL` para quem não tem vínculo → `usuario_id = NULL`
é `NULL` (nem true) → **nega**. Conta não provisionada não vê nada.

### Regras ao mexer aqui
- **Sempre** `alter table ... enable row level security` **explicitamente**. Criar policy em tabela sem
  RLS ligada é um **no-op silencioso** — a tabela fica aberta e nada avisa. (Esse bug existiu nesta
  migration e foi pego na revisão.)
- **Sempre** `revoke all ... from anon` (defesa em profundidade, padrão da 001).
- O backend da Sofia usa **service_role (BYPASSRLS)** — mudanças de RLS **não afetam** o backend.

---

## 3. Rotas e acesso — `lib/supabase/proxy.ts`

Três níveis, nesta ordem:

1. **Público** (`PUBLIC_PATHS` / `PUBLIC_PREFIXES`): `/`, `/login`, `/proposta*`, `/imunolab`, assets.
2. **Qualquer logado** (`AUTENTICADO_PREFIXES = ['/agenda', '/conta']`) — não exige admin.
3. **Todo o resto** → exige `is_admin` (**fail-closed**: erro na checagem = bloqueio).

> Rotas novas **nascem admin-only** (deny-by-default). Só entre em `AUTENTICADO_PREFIXES` se a
> autorização real estiver garantida no backend (RLS ou escopo da própria sessão) — **nunca** confie
> no proxy como fronteira de segurança.

---

## 4. Páginas

- **`app/(app)/agenda/page.tsx`** — CRUD de compromissos. Admin tem seletor de usuário
  (Valmir / Henrique / Todos). **"Todos" é só filtro de visualização**: ao criar, o dono é escolhido
  explicitamente no campo "Para". Henrique não vê nem o seletor nem o campo de dono.
- **`app/(app)/conta/page.tsx`** — o usuário troca a **própria** senha (`supabase.auth.updateUser`,
  que opera sempre sobre a sessão de quem chama — não há como alterar a senha de outra conta).
- **`app/(app)/layout.tsx`** — menu mínimo (Agenda, Conta, Sair; + "Área admin" se `is_admin`).
- `lib/agenda-data.ts` — contexto do usuário + CRUD via browser client. **Não faz checagem de escopo
  própria** — de propósito: a RLS decide, e duplicar a regra no cliente só cria uma segunda fonte de
  verdade para divergir.
- `lib/tempo.ts` — entrada em SP via offset fixo (`${data}T${hora}:00-03:00`), exibição via `Intl`.

---

## 5. Fonte única com o WhatsApp

A agenda do painel e a da Sofia são **as mesmas tabelas** (`agenda_compromissos`, `usuarios`).
Compromisso criado no painel → a Sofia lembra no WhatsApp; criado no WhatsApp → aparece no painel.
**Zero sincronização, zero cópia.**

---

## 6. Scripts operacionais

- **`scripts/provisionar-usuario.mjs`** (service_role) — cria/acha o auth user por e-mail e liga
  `usuarios.auth_user_id`. **Gera senha aleatória** (`randomBytes`) se nenhuma for passada.
  > ⚠️ Havia uma senha default **hardcoded** (`Trocar@123`) aqui — pega no `/security-review` e
  > removida. O endpoint de auth do Supabase é **público** e a anon key vai no bundle do browser:
  > uma senha conhecida = **bypass de autenticação em um palpite**. Nunca reintroduza default fixo.
  ```bash
  node --env-file=.env.local scripts/provisionar-usuario.mjs <email> <whatsapp> 
  ```
- **`scripts/verify-agenda-rls.mjs`** — **portão de segurança**: loga como dois usuários e prova o
  isolamento **por identidade** (não por contagem — contagem dava falso negativo). Tenta ativamente
  vazar: ler linhas de outro dono e **criar compromisso como outro dono**. Falha (exit≠0) se
  conseguir, e também **se o probe de escrita não puder rodar** (nada de "OK" vazio).
  ```bash
  node --env-file=.env.local scripts/verify-agenda-rls.mjs <adminEmail> <senha> <userEmail> <senha>
  ```
  **Rodar sempre que mexer na RLS.** Um `npm run build` verde não prova nada sobre isolamento.

---

## 7. Ordem de deploy (importa)

1. Verificar que as views respeitam RLS:
   ```sql
   select c.relname, c.reloptions from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='v';
   ```
   Todas devem ter `security_invoker=on`. (Sem isso, uma view roda como dona e **bypassa a RLS das
   tabelas base** — foi o mecanismo do vazamento original.)
2. Rodar a migration no SQL Editor.
3. Provisionar o usuário (a coluna `auth_user_id` precisa existir → **depois** da migration).
4. `verify-agenda-rls.mjs` passar **com o probe de escrita executado**.
5. Push na `main` → Vercel deploya.

### ⚠️ Gotcha do SQL Editor do Supabase
Ele **quebra o script nos `;` internos de um bloco `do $$ ... $$`**, deixando o `$$` sem fechar →
`ERROR: 42601: syntax error at end of input`. **Evite blocos `do`** (escreva o DDL explícito) e use
**tag única** no corpo de funções (`$fn$ ... $fn$`). A migration 002 foi reescrita por causa disso.
