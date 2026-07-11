-- 002_agenda_rls_per_user.sql (repo dashboard) — RLS por-usuário na agenda.
-- Idempotente. Rodar no SQL Editor do Supabase.
-- Requer: migration 001 (is_admin) e a 002_agenda.sql da Sofia (tabelas) já aplicadas.

begin;

-- 1. Vínculo auth <-> usuarios
alter table public.usuarios
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

-- 2. Resolve a usuarios.id do usuário logado (SECURITY DEFINER corta recursão de RLS)
create or replace function public.current_usuario_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.usuarios where auth_user_id = auth.uid();
$$;
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

-- 4. agenda_compromissos e agenda_lembretes: admin OU dono.
do $$
declare t text;
begin
  foreach t in array array['agenda_compromissos','agenda_lembretes'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists admin_all on public.%I;', t);
    execute format('drop policy if exists owner_all on public.%I;', t);
    execute format(
      'create policy owner_all on public.%I for all to authenticated '
      'using (public.is_admin() or usuario_id = public.current_usuario_id()) '
      'with check (public.is_admin() or usuario_id = public.current_usuario_id());', t);
    execute format('revoke all on public.%I from anon;', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated;', t);
  end loop;
end $$;

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
--   select policyname, cmd, qual from pg_policies
--    where tablename in ('usuarios','agenda_compromissos','agenda_lembretes');
