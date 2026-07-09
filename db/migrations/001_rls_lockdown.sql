-- ============================================================
-- 001_rls_lockdown.sql
--
-- Fecha o acesso anônimo ao banco. Antes desta migration, a anon key
-- (que é pública, vai no bundle do browser) conseguia LER e ESCREVER
-- propostas, módulos, serviços e acessos, e LER todos os leads através
-- das views leads_dashboard / ficha_atual / estatisticas_gerais.
--
-- Causa raiz: db/fix-rls.sql referencia as tabelas users, projetos e
-- agenor_proposals, que nunca existiram neste banco. O script abortou na
-- primeira referência inválida, depois de já ter dropado as policies
-- antigas — deixando tabelas com RLS sem policy ou sem RLS.
--
-- Esta migration é idempotente e define o estado final explicitamente,
-- sem depender de qual era o estado anterior.
--
-- RODAR NO SQL EDITOR DO SUPABASE ANTES DE FAZER DEPLOY DO proxy.ts.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. public.users — nunca foi criada em produção.
--    Sem ela, o check de is_admin do middleware sempre falhava.
-- ------------------------------------------------------------
create table if not exists public.users (
  id         uuid primary key references auth.users on delete cascade,
  email      text unique not null,
  nome       text,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

-- Backfill dos usuários que já existem no auth
insert into public.users (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- Promove o Valmir a admin (sem isso, ninguém acessa o dashboard)
update public.users
   set is_admin = true
 where email = 'veronezrepresentacoes@gmail.com';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 2. is_admin() — SECURITY DEFINER.
--    Ler public.users de dentro de uma policy de public.users causa
--    recursão infinita de RLS. Rodar como owner corta a recursão.
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select u.is_admin from public.users u where u.id = auth.uid()), false);
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- users: cada um lê só a própria linha. Sem policy de "admin lê todos"
-- (é ela que gerava a recursão original).
do $$
declare p record;
begin
  for p in select policyname from pg_policies
            where schemaname = 'public' and tablename = 'users'
  loop
    execute format('drop policy %I on public.users', p.policyname);
  end loop;
end $$;

alter table public.users enable row level security;
create policy users_self_read on public.users
  for select to authenticated using (id = auth.uid());

revoke all on public.users from anon;
grant select on public.users to authenticated;

-- ------------------------------------------------------------
-- 3. Tabelas de aplicação: RLS ligada, acesso só para admin
--    autenticado. O anon perde até o GRANT (defesa em profundidade:
--    se uma policy for removida por engano no futuro, o anon ainda
--    não consegue ler nada).
--
--    O backend da Sofia e as rotas /api/* usam service_role, que tem
--    BYPASSRLS — nada disso quebra a página pública da proposta.
-- ------------------------------------------------------------
do $$
declare
  t text;
  p record;
  reg oid;
  kind "char";
  alvos text[] := array[
    'leads', 'mensagens', 'ficha_campos', 'frases_ouro', 'follow_ups',
    'propostas', 'proposta_modulos', 'proposta_servicos',
    'proposta_acessos', 'proposta_aceites',
    'notificacoes_valmir', 'eventos_sistema',
    'configuracoes'
  ];
begin
  foreach t in array alvos loop
    reg := to_regclass('public.' || t);
    if reg is null then
      raise notice 'relacao ausente, pulando: %', t;
      continue;
    end if;

    -- RLS só existe em tabela base ('r') ou particionada ('p'). Views são
    -- tratadas no bloco 4. Isto protege contra confundir view com tabela.
    select relkind into kind from pg_class where oid = reg;
    if kind not in ('r', 'p') then
      raise notice 'nao e tabela base (relkind=%): %, tratando como view', kind, t;
      continue;
    end if;

    for p in select policyname from pg_policies
              where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;

    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy admin_all on public.%I for all to authenticated '
      'using (public.is_admin()) with check (public.is_admin())', t);

    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 4. Views — o vazamento mais grave.
--    Uma view roda com as permissões do dono, então a RLS das tabelas
--    base é ignorada: leads_dashboard entregava nome e WhatsApp dos 13
--    leads para qualquer visitante anônimo.
--    Nenhuma das três é usada em runtime (só em docs e scripts SQL).
-- ------------------------------------------------------------
do $$
declare
  v text;
  views text[] := array['leads_dashboard', 'ficha_atual', 'estatisticas_gerais', 'config'];
begin
  foreach v in array views loop
    if to_regclass('public.' || v) is null then
      continue;
    end if;

    execute format('revoke all on public.%I from anon', v);
    execute format('grant select on public.%I to authenticated', v);

    -- security_invoker faz a view respeitar a RLS de quem a consulta.
    -- Requer Postgres 15+; se não existir, o REVOKE acima já fecha o buraco.
    begin
      execute format('alter view public.%I set (security_invoker = on)', v);
    exception when others then
      raise notice 'security_invoker indisponível para %, mantendo apenas o REVOKE', v;
    end;
  end loop;
end $$;

commit;

-- ============================================================
-- Verificação (rodar depois, ou usar scripts/verify-rls.mjs):
--
--   select tablename, rowsecurity from pg_tables
--    where schemaname = 'public' order by tablename;
--
--   select tablename, policyname, roles from pg_policies
--    where schemaname = 'public' order by tablename;
--
--   select email, is_admin from public.users;   -- Valmir = true
-- ============================================================
