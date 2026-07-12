-- 002_agenda_rls_per_user.sql (repo dashboard) — RLS por-usuário na agenda.
-- Idempotente. Rodar no SQL Editor do Supabase.
-- Requer: migration 001 (is_admin) e a 002_agenda.sql da Sofia (tabelas) já aplicadas.
--
-- Nota: SEM bloco `do $$ ... $$` e com tag única `$fn$` no corpo da função.
-- O SQL Editor do Supabase quebra o script nos `;` internos de um bloco
-- dollar-quoted, deixando o `$$` sem fechar ("syntax error at end of input").
-- Como são só duas tabelas de agenda, escrevê-las explicitamente é mais
-- simples, mais legível e imune a esse problema de parsing.

begin;

-- 1. Vínculo auth <-> usuarios
alter table public.usuarios
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

-- 2. Resolve a usuarios.id do usuário logado (SECURITY DEFINER corta recursão de RLS)
create or replace function public.current_usuario_id()
returns uuid language sql stable security definer set search_path = public as $fn$
  select id from public.usuarios where auth_user_id = auth.uid();
$fn$;
revoke all on function public.current_usuario_id() from public, anon;
grant execute on function public.current_usuario_id() to authenticated, service_role;

-- 3. usuarios: admin vê todas; usuário comum vê a própria. Escrita = admin.
alter table public.usuarios enable row level security;
drop policy if exists admin_all on public.usuarios;
drop policy if exists usuarios_self_read on public.usuarios;
drop policy if exists usuarios_admin_write on public.usuarios;
create policy usuarios_self_read on public.usuarios
  for select to authenticated
  using (public.is_admin() or auth_user_id = auth.uid());
create policy usuarios_admin_write on public.usuarios
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.usuarios from anon;
grant select, insert, update, delete on public.usuarios to authenticated;

-- 4a. agenda_compromissos: admin OU dono.
alter table public.agenda_compromissos enable row level security;
drop policy if exists admin_all on public.agenda_compromissos;
drop policy if exists owner_all on public.agenda_compromissos;
create policy owner_all on public.agenda_compromissos
  for all to authenticated
  using (public.is_admin() or usuario_id = public.current_usuario_id())
  with check (public.is_admin() or usuario_id = public.current_usuario_id());
revoke all on public.agenda_compromissos from anon;
grant select, insert, update, delete on public.agenda_compromissos to authenticated;

-- 4b. agenda_lembretes: admin OU dono.
alter table public.agenda_lembretes enable row level security;
drop policy if exists admin_all on public.agenda_lembretes;
drop policy if exists owner_all on public.agenda_lembretes;
create policy owner_all on public.agenda_lembretes
  for all to authenticated
  using (public.is_admin() or usuario_id = public.current_usuario_id())
  with check (public.is_admin() or usuario_id = public.current_usuario_id());
revoke all on public.agenda_lembretes from anon;
grant select, insert, update, delete on public.agenda_lembretes to authenticated;

-- 5. Liga o Valmir (o do Henrique é ligado pelo script de provisionamento).
update public.usuarios u
   set auth_user_id = au.id
  from auth.users au
 where au.email = 'veronezrepresentacoes@gmail.com'
   and u.whatsapp_numero = '5543988569827'
   and u.auth_user_id is null;

commit;

-- Verificação:
--   select nome, whatsapp_numero, auth_user_id from public.usuarios;
--   select tablename, policyname, cmd from pg_policies
--    where tablename in ('usuarios','agenda_compromissos','agenda_lembretes');
