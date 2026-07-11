# Agenda no Dashboard, Multiusuário (Valmir admin + Henrique) — Design

- **Data:** 2026-07-11
- **Status:** Design aprovado no brainstorming; aguardando revisão da spec antes do plano.
- **Repo primário:** `vveronez.dev` (dashboard Next.js 16). Toca também o banco Supabase compartilhado.
- **Depende de:** Estágio 1 da agenda (tabelas `usuarios`, `agenda_compromissos`, `agenda_lembretes` já em produção; ver spec da Sofia `2026-07-11-sofia-agenda-pessoal-multiusuario-design.md`).

## 1. Contexto e motivação

Hoje a agenda só é editável por comando no WhatsApp (Sofia). O Valmir quer editá-la também no
painel `vveronez.dev`, e o **Henrique** precisa acessar a **dele** com login próprio. O dashboard
hoje é **single-admin**: `proxy.ts` e `requireAdmin()` exigem `is_admin`, e a RLS de todas as
tabelas é `admin_all` (só Valmir). Este design evolui isso para: **admin (Valmir) + usuário comum
(Henrique, só agenda)**, com **RLS por-usuário** nas tabelas de agenda.

Princípio central: o painel e o WhatsApp escrevem nas **mesmas** tabelas `agenda_compromissos` —
**fonte única, sem sincronização**. Compromisso criado no painel → Sofia lembra no Whats; criado
no Whats → aparece no painel.

## 2. Escopo

### Nesta feature
- Login provisionado para o Henrique (Supabase Auth, `is_admin=false`), vinculado à sua linha em `usuarios`.
- **RLS por-usuário assimétrica** nas 3 tabelas de agenda: admin vê tudo; usuário comum vê só o dele.
- Página `/agenda` no dashboard: listar + criar + editar + remover compromissos, com os campos do modelo da Sofia (título, data, hora, recorrência, antecedência), em fuso `America/Sao_Paulo`.
- Para o admin: **seletor de usuário** (Valmir / Henrique / ambos) na `/agenda`.
- Controle de acesso: `/agenda` acessível a qualquer usuário logado; páginas de negócio seguem admin-only. Henrique vê um menu mínimo (só Agenda + Sair).

### Fora de escopo (YAGNI)
- Henrique acessar/editar leads, propostas, analytics, configurações de negócio.
- Multi-tenant / assinatura (isso é o projeto SOFIA-SAAS, à parte).
- Auto-signup (contas são provisionadas).
- Henrique editar suas próprias configs de lembrete (resumo_horario etc.) — escrita em `usuarios` fica admin-only nesta feature; pode virar enhancement depois.
- Lembrete-enquete / consistência (Estágio 2 da Sofia).

## 3. Modelo de usuários e vínculo

- Nova coluna em `public.usuarios`: `auth_user_id uuid unique references auth.users(id) on delete set null` (nullable — nem toda linha precisa de login).
- **Provisionamento** (uma vez, via Supabase Auth admin / script service_role — NÃO é rota de runtime):
  - Criar o auth user do Henrique (e-mail dele + senha temporária que ele troca no 1º acesso). O trigger `handle_new_user` (migration 001) cria `public.users` com `is_admin=false`.
  - Setar `usuarios.auth_user_id` = auth id do Henrique na linha do Henrique; e = auth id do Valmir (`veronezrepresentacoes@gmail.com`) na linha do Valmir.
- **Item em aberto:** e-mail do Henrique (necessário no provisionamento).

## 4. RLS por-usuário (núcleo de segurança)

Função de resolução (SECURITY DEFINER, corta recursão de RLS como `is_admin()`):
```sql
create or replace function public.current_usuario_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.usuarios where auth_user_id = auth.uid();
$$;
-- revoke de anon; grant execute a authenticated.
```

Nas 3 tabelas de agenda, trocar a policy `admin_all` (criada na 002 da Sofia) por assimétrica:
- `public.usuarios`:
  - SELECT: `using (public.is_admin() or auth_user_id = auth.uid())` — usuário vê a própria linha; admin vê todas (precisa para o seletor).
  - INSERT/UPDATE/DELETE: `using/with check (public.is_admin())` — provisionamento e edição de usuários é admin-only.
- `public.agenda_compromissos` (policy `for all`):
  - `using (public.is_admin() or usuario_id = public.current_usuario_id())`
  - `with check (public.is_admin() or usuario_id = public.current_usuario_id())` — impede o Henrique de criar/editar como outro dono; admin cria para qualquer um.
- `public.agenda_lembretes` (policy `for all`):
  - `using/with check (public.is_admin() or usuario_id = public.current_usuario_id())` — leitura do log escopada; o worker escreve via service_role (bypass RLS), o painel não escreve nesta tabela.

Manter o padrão da 001: `revoke all ... from anon` + `grant select/insert/update/delete ... to authenticated` nas tabelas. As **tabelas de negócio não mudam** (seguem `admin_all`).

**Nota de segurança:** como o backend da Sofia usa service_role (BYPASSRLS), esta mudança **não afeta** o backend. O painel usa a sessão do usuário (anon key + cookie), então a RLS é o ponto de decisão real.

## 5. Controle de rota e acesso (dashboard)

- **`proxy.ts`**: hoje toda rota não-pública exige `is_admin`. Passa a ter dois níveis:
  - Público → bypass (como hoje).
  - Sem sessão → `/login`.
  - `/agenda` e filhos (`pathname === '/agenda' || startsWith('/agenda/')`) → **qualquer usuário logado** (não exige is_admin). A RLS garante que Henrique só vê o dele.
  - Demais rotas não-públicas → exige `is_admin` (check atual, inalterado).
- **Route group `(app)`**: nova pasta `app/(app)/agenda/` com layout próprio (minimal). O layout mostra marca + link Agenda + Sair; se o usuário for admin, também um link para a área admin (`/dashboard`). Henrique só vê Agenda + Sair. (O grupo `(admin)` e seu layout/sidebar ficam intactos, admin-only.)
- **Abordagem de dados = A (cliente + RLS):** a `/agenda` lê/escreve direto via `lib/supabase/client` + `server` com a sessão; a RLS por-usuário isola. **Sem novas rotas `/api`** (o provisionamento do Henrique é setup único, não runtime). O admin, ao criar para o Henrique, seta `usuario_id` = id do Henrique (o `with check` admin permite).

## 6. UI da página `/agenda`

- Lista de compromissos do escopo atual (ordenada por próxima ocorrência), com criar/editar/remover.
- Formulário com: `titulo`, `data` (date), `hora` (time), `recorrencia` (nenhuma/diária/semanal + `dias_semana` quando semanal), `antecedencia_min`, `descricao` opcional.
- **Fuso:** converter `data`+`hora` locais (SP) → `inicio_em` (timestamptz) e exibir instantes em SP. Helper novo `lib/tempo.ts` no dashboard (espelha `instanteSP`/`partesSP`, offset fixo -03:00 — mesma premissa do backend).
- **Admin:** seletor de usuário no topo (Valmir / Henrique / Ambos) que **filtra a lista**. "Ambos" é só visualização — ao **criar** um compromisso, o admin escolhe o dono explicitamente (um campo "para: Valmir/Henrique", default o próprio Valmir; nunca cria com escopo "ambos"). Henrique não vê o seletor nem o campo de dono (só a dele).
- **Resolução do `usuario_id`:** o cliente descobre a própria `usuarios.id` lendo a própria linha de `usuarios` (permitido pela policy self-read); ao inserir, envia esse `usuario_id` (Henrique só o dele; admin o do dono escolhido) e o `with check` valida.
- Seguir os padrões visuais/CSS existentes do dashboard (classes `admin-*`, tema escuro/dourado).

## 7. Fonte única com o WhatsApp

Sem duplicação nem sync: o painel opera sobre `agenda_compromissos`/`usuarios` diretamente. O worker
da Sofia (backend) continua lendo essas tabelas via service_role e disparando lembretes. Editar no
painel muda o que a Sofia lembra, e vice-versa, imediatamente.

## 8. Migration e deploy

- Nova migration no repo do dashboard: `db/migrations/002_agenda_rls_per_user.sql` (idempotente):
  1. `alter table usuarios add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;`
  2. `create or replace function current_usuario_id() ...;` (grants).
  3. Trocar as policies `admin_all` das 3 tabelas de agenda pelas assimétricas acima (drop if exists + create).
  4. (Opcional no SQL, ou passo manual) setar `auth_user_id` do Valmir por e-mail; o do Henrique depois que o auth user existir.
- **Ordem de deploy:** (1) provisionar auth user do Henrique + vincular `auth_user_id` dos dois; (2) rodar a migration no Supabase; (3) deploy do dashboard (Vercel, push na main do repo do dashboard). Como envolve RLS, rodar `/security-review` na migration + no `proxy.ts` **antes** do deploy.
- **Next.js 16:** o repo avisa (AGENTS.md) que este Next tem breaking changes — consultar `node_modules/next/dist/docs/` antes de codar rotas/proxy.

## 9. Testes e verificação

- **RLS (crítico):** verificar que, com a sessão do Henrique, um `select` em `agenda_compromissos` retorna só as linhas dele e um `insert` como `usuario_id` do Valmir é **rejeitado**; e que a sessão do Valmir (admin) vê ambos. Script nos moldes do `scripts/verify-rls.mjs` (referenciado na 001) com dois logins.
- **Acesso de rota:** Henrique logado alcança `/agenda` mas é redirecionado ao tentar `/leads`/`/propostas`; sem sessão → `/login`.
- **Fuso:** compromisso criado às 15:00 no painel aparece 15:00 e o `inicio_em` corresponde a 18:00Z.
- **Fonte única:** compromisso criado no painel aparece no `listar_compromissos` da Sofia (e o inverso).

## 10. Itens em aberto
- E-mail do Henrique (provisionamento).
- Confirmar que `scripts/verify-rls.mjs` existe/serve de base (senão, criar verificação equivalente).
