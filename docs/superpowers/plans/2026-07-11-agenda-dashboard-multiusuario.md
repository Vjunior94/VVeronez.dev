# Agenda no Dashboard Multiusuário — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma página `/agenda` editável no dashboard vveronez.dev, com login do Henrique e isolamento por-usuário (admin Valmir vê tudo, Henrique só o dele), operando sobre as mesmas tabelas que a Sofia usa.

**Architecture:** RLS por-usuário assimétrica no Supabase (via `current_usuario_id()` + `usuarios.auth_user_id`) é o único ponto de decisão de isolamento. A página `/agenda` é um client component que lê/escreve direto via `@supabase/ssr` browser client (Abordagem A — a sessão + RLS isolam). O `proxy.ts` libera `/agenda` para qualquer usuário logado; o resto segue admin-only.

**Tech Stack:** Next.js 16 (App Router, route groups), `@supabase/ssr`, TypeScript, lucide-react, CSS vars existentes. Sem novas rotas `/api`. Scripts de deploy em Node (`.mjs`, service_role).

## Global Constraints

- **Isolamento é a RLS.** O painel usa a sessão do usuário (anon key + cookie), então a RLS por-usuário é a autorização real — o `proxy.ts` é só UX. Nunca confiar só no proxy.
- **Fonte única:** operar sobre `public.agenda_compromissos` / `public.usuarios` diretamente — as mesmas tabelas que a Sofia (backend) usa. Nenhuma cópia/sync.
- **Admin assimétrico:** `using/with check (public.is_admin() or usuario_id = public.current_usuario_id())`. Henrique (`is_admin=false`) só o dele; Valmir vê/edita tudo.
- **Fuso:** entrada = `${data}T${hora}:00-03:00` (São Paulo, sem DST desde 2019); exibição via `Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' })`.
- **Tabelas de negócio não mudam** (seguem `admin_all`). Henrique nunca acessa leads/propostas/analytics/settings.
- **Next 16:** breaking changes — ver `node_modules/next/dist/docs/` antes de código novo de rota/proxy. Seguir os padrões existentes (`lib/supabase/{client,server,proxy}.ts`, páginas `(admin)/*` client-component + `useCachedFetch`).
- **Deploy é ordenado + `/security-review` antes:** ver Checklist de deploy no fim.
- **Este repo (dashboard) auto-deploya na Vercel no push pra `main`.** Trabalhar em branch; não pushar sem autorização.

---

## Estrutura de arquivos

**Criar:**
- `db/migrations/002_agenda_rls_per_user.sql` — `auth_user_id`, `current_usuario_id()`, RLS por-usuário nas 3 tabelas de agenda.
- `lib/tempo.ts` — `spParaInstante(data, hora)` e `formatarInstanteSP(iso)`.
- `lib/agenda-data.ts` — tipos + contexto do usuário (`carregarContexto`) + CRUD (`criar/atualizar/remover/listar`) via browser client.
- `app/(app)/layout.tsx` — layout mínimo (Agenda + Sair; admin também vê link p/ área admin).
- `app/(app)/agenda/page.tsx` — a página da agenda (lista + form + seletor admin).
- `scripts/provisionar-usuario.mjs` — cria/acha auth user por e-mail e liga `usuarios.auth_user_id` (service_role).
- `scripts/verify-agenda-rls.mjs` — verifica isolamento com duas sessões.

**Modificar:**
- `lib/supabase/proxy.ts` — liberar `/agenda*` para qualquer usuário logado.
- `app/(admin)/layout.tsx` — adicionar item "Agenda" no menu (para o Valmir chegar na página).

---

## Task 1: Migration — auth_user_id + current_usuario_id() + RLS por-usuário

**Files:**
- Create: `db/migrations/002_agenda_rls_per_user.sql`

**Interfaces:**
- Produces (schema): coluna `usuarios.auth_user_id`, função `public.current_usuario_id()`, policies por-usuário em `usuarios`/`agenda_compromissos`/`agenda_lembretes`.

- [ ] **Step 1: Escrever a migration**

`db/migrations/002_agenda_rls_per_user.sql`:
```sql
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
```

- [ ] **Step 2: Verificação (documental)**

Não roda em CI. No PR, registrar: "rodar `002_agenda_rls_per_user.sql` no SQL Editor do Supabase (projeto SOFIA) — DEPOIS de provisionar o auth user do Henrique OU antes (o vínculo dele é feito pelo script)". A verificação real é a Task 7 (verify-agenda-rls).

- [ ] **Step 3: Commit**

```bash
git add db/migrations/002_agenda_rls_per_user.sql
git commit -m "feat(agenda): migration RLS por-usuario + auth_user_id + current_usuario_id"
```

---

## Task 2: proxy.ts — liberar /agenda para qualquer usuário logado

**Files:**
- Modify: `lib/supabase/proxy.ts`

**Interfaces:**
- Consumes: estrutura atual de `updateSession` (checa sessão + is_admin).

- [ ] **Step 1: Inserir o nível "autenticado" para /agenda**

Em `lib/supabase/proxy.ts`, logo APÓS o bloco `if (!user) { ... redirect /login }` e ANTES do bloco que consulta `is_admin`, inserir:
```ts
  // /agenda é acessível a QUALQUER usuário logado (admin ou comum).
  // A RLS por-usuário garante que cada um só enxerga a própria agenda.
  if (pathname === '/agenda' || pathname.startsWith('/agenda/')) {
    return supabaseResponse;
  }
```
O bloco seguinte (consulta `users.is_admin` e redireciona se não-admin) permanece inalterado — continua protegendo todas as demais rotas.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/proxy.ts
git commit -m "feat(agenda): proxy libera /agenda para usuario logado nao-admin"
```

---

## Task 3: lib/tempo.ts — conversão de fuso SP

**Files:**
- Create: `lib/tempo.ts`

**Interfaces:**
- Produces:
  - `spParaInstante(data: string, hora: string): string` — `data`='YYYY-MM-DD', `hora`='HH:MM' → ISO UTC (`.toISOString()`).
  - `formatarInstanteSP(iso: string): string` — ex "sex, 11/07 15:00".
  - `partesInstanteSP(iso: string): { data: string; hora: string }` — para preencher o form ao editar.

- [ ] **Step 1: Implementar**

`lib/tempo.ts`:
```ts
// America/Sao_Paulo. Entrada usa offset fixo -03:00 (Brasil sem DST desde 2019);
// exibição usa Intl (o browser tem tz data completa).

export function spParaInstante(data: string, hora: string): string {
  // data=YYYY-MM-DD, hora=HH:MM → instante UTC
  return new Date(`${data}T${hora}:00-03:00`).toISOString();
}

const FMT = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  weekday: 'short', day: '2-digit', month: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
});

export function formatarInstanteSP(iso: string): string {
  // ex: "sex., 11/07, 15:00" → normaliza para "sex 11/07 15:00"
  return FMT.format(new Date(iso)).replace(/\.,?/g, '').replace(/,/g, '').replace(/\s+/g, ' ').trim();
}

export function partesInstanteSP(iso: string): { data: string; hora: string } {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return { data: `${get('year')}-${get('month')}-${get('day')}`, hora: `${get('hour')}:${get('minute')}` };
}
```

- [ ] **Step 2: Verificação rápida (node, sem test runner no dashboard)**

Run:
```bash
node -e "const d=new Date('2026-07-11T15:00:00-03:00'); console.log(d.toISOString())"
```
Expected: `2026-07-11T18:00:00.000Z` (confirma o offset -03:00). A verificação de `formatarInstanteSP`/`partesInstanteSP` acontece ao rodar o app (Task 8/Final).

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit` (sem erros).
```bash
git add lib/tempo.ts
git commit -m "feat(agenda): helper de fuso SP no dashboard"
```

---

## Task 4: lib/agenda-data.ts — contexto do usuário + CRUD

**Files:**
- Create: `lib/agenda-data.ts`

**Interfaces:**
- Consumes: `createClient` de `@/lib/supabase/client`; `spParaInstante` de `@/lib/tempo`.
- Produces:
  - `interface UsuarioAgenda { id: string; nome: string; whatsapp_numero: string }`
  - `interface Compromisso { id: string; usuario_id: string; titulo: string; descricao: string | null; inicio_em: string; recorrencia: 'nenhuma'|'diaria'|'semanal'; dias_semana: number[] | null; antecedencia_min: number; ativo: boolean }`
  - `interface ContextoAgenda { isAdmin: boolean; usuarios: UsuarioAgenda[]; meuUsuarioId: string | null }`
  - `carregarContexto(): Promise<ContextoAgenda>`
  - `listarCompromissos(usuarioId: string | 'todos'): Promise<Compromisso[]>`
  - `criarCompromisso(input): Promise<{ error: string | null }>`
  - `atualizarCompromisso(id, input): Promise<{ error: string | null }>`
  - `removerCompromisso(id): Promise<{ error: string | null }>`
  - `type FormInput = { usuario_id: string; titulo: string; data: string; hora: string; recorrencia: Compromisso['recorrencia']; dias_semana: number[]; antecedencia_min: number; descricao: string }`

- [ ] **Step 1: Implementar**

`lib/agenda-data.ts`:
```ts
import { createClient } from '@/lib/supabase/client';
import { spParaInstante } from '@/lib/tempo';

export interface UsuarioAgenda { id: string; nome: string; whatsapp_numero: string }
export interface Compromisso {
  id: string; usuario_id: string; titulo: string; descricao: string | null;
  inicio_em: string; recorrencia: 'nenhuma' | 'diaria' | 'semanal';
  dias_semana: number[] | null; antecedencia_min: number; ativo: boolean;
}
export interface ContextoAgenda { isAdmin: boolean; usuarios: UsuarioAgenda[]; meuUsuarioId: string | null }
export type FormInput = {
  usuario_id: string; titulo: string; data: string; hora: string;
  recorrencia: Compromisso['recorrencia']; dias_semana: number[];
  antecedencia_min: number; descricao: string;
};

const COLS = 'id, usuario_id, titulo, descricao, inicio_em, recorrencia, dias_semana, antecedencia_min, ativo';

export async function carregarContexto(): Promise<ContextoAgenda> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { isAdmin: false, usuarios: [], meuUsuarioId: null };

  const { data: perfil } = await supabase.from('users').select('is_admin').eq('id', user.id).single();
  const isAdmin = !!perfil?.is_admin;

  // RLS: admin vê todos os usuarios; comum vê só a própria linha.
  const { data: us } = await supabase
    .from('usuarios').select('id, nome, whatsapp_numero').eq('ativo', true).order('nome');
  const usuarios = (us ?? []) as UsuarioAgenda[];

  // meuUsuarioId: a linha ligada ao auth do usuário (via a coluna auth_user_id).
  const { data: minha } = await supabase
    .from('usuarios').select('id').eq('auth_user_id', user.id).maybeSingle();
  return { isAdmin, usuarios, meuUsuarioId: minha?.id ?? null };
}

export async function listarCompromissos(usuarioId: string | 'todos'): Promise<Compromisso[]> {
  const supabase = createClient();
  let q = supabase.from('agenda_compromissos').select(COLS).eq('ativo', true);
  if (usuarioId !== 'todos') q = q.eq('usuario_id', usuarioId);
  const { data } = await q.order('inicio_em', { ascending: true });
  return (data ?? []) as Compromisso[];
}

function payload(input: FormInput) {
  return {
    usuario_id: input.usuario_id,
    titulo: input.titulo,
    descricao: input.descricao || null,
    inicio_em: spParaInstante(input.data, input.hora),
    recorrencia: input.recorrencia,
    dias_semana: input.recorrencia === 'semanal' ? input.dias_semana : null,
    antecedencia_min: input.antecedencia_min,
  };
}

export async function criarCompromisso(input: FormInput): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.from('agenda_compromissos').insert(payload(input));
  return { error: error?.message ?? null };
}

export async function atualizarCompromisso(id: string, input: FormInput): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.from('agenda_compromissos')
    .update({ ...payload(input), atualizado_em: new Date().toISOString() }).eq('id', id);
  return { error: error?.message ?? null };
}

export async function removerCompromisso(id: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.from('agenda_compromissos').update({ ativo: false }).eq('id', id);
  return { error: error?.message ?? null };
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` (sem erros).
```bash
git add lib/agenda-data.ts
git commit -m "feat(agenda): camada de dados da agenda no dashboard (contexto + CRUD)"
```

---

## Task 5: app/(app)/layout.tsx — layout mínimo compartilhado

**Files:**
- Create: `app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `createClient` de `@/lib/supabase/client`.

- [ ] **Step 1: Implementar (espelha o padrão de `(admin)/layout.tsx`, versão enxuta)**

`app/(app)/layout.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CalendarDays, LogOut, LayoutDashboard } from 'lucide-react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      if (user.email) setEmail(user.email);
      const { data } = await supabase.from('users').select('is_admin').eq('id', user.id).single();
      setIsAdmin(!!data?.is_admin);
    });
  }, []);

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <a href="/" className="brand-logo" aria-label="VVeronez.Dev">
            <span className="brand-wordmark"><span className="brand-vv" style={{ fontSize: '1.2rem' }}>VV</span>
              <span className="brand-eronez" style={{ fontSize: '0.9rem' }}>eronez</span></span>
            <span className="brand-dot" style={{ fontSize: '0.9rem' }}>.</span>
            <span className="brand-tld" style={{ fontSize: '0.7rem' }}>Dev</span>
          </a>
        </div>
        <nav className="admin-sidebar-nav">
          <a href="/agenda" className="admin-nav-link active"><CalendarDays /><span>Agenda</span></a>
          {isAdmin && <a href="/dashboard" className="admin-nav-link"><LayoutDashboard /><span>Área admin</span></a>}
        </nav>
        <div className="admin-sidebar-footer">
          <div className="admin-user-info">
            <div className="admin-user-avatar">{email ? email[0].toUpperCase() : '?'}</div>
            <span className="admin-user-email">{email}</span>
          </div>
          <button className="admin-logout" onClick={logout}><LogOut size={16} /><span>Sair</span></button>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-header"><div className="admin-breadcrumb"><span>agenda</span></div></header>
        <div className="admin-content">{children}</div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` (sem erros).
```bash
git add "app/(app)/layout.tsx"
git commit -m "feat(agenda): layout minimo do grupo (app)"
```

---

## Task 6: app/(app)/agenda/page.tsx — página da agenda

**Files:**
- Create: `app/(app)/agenda/page.tsx`

**Interfaces:**
- Consumes: `carregarContexto`, `listarCompromissos`, `criarCompromisso`, `atualizarCompromisso`, `removerCompromisso`, tipos `Compromisso`/`ContextoAgenda`/`FormInput` de `@/lib/agenda-data`; `formatarInstanteSP`, `partesInstanteSP` de `@/lib/tempo`.

- [ ] **Step 1: Implementar**

`app/(app)/agenda/page.tsx`:
```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Pencil, CalendarDays, Clock } from 'lucide-react';
import {
  carregarContexto, listarCompromissos, criarCompromisso, atualizarCompromisso, removerCompromisso,
  type Compromisso, type ContextoAgenda, type FormInput,
} from '@/lib/agenda-data';
import { formatarInstanteSP, partesInstanteSP } from '@/lib/tempo';

const DIAS = [{ n: 0, l: 'D' }, { n: 1, l: 'S' }, { n: 2, l: 'T' }, { n: 3, l: 'Q' }, { n: 4, l: 'Q' }, { n: 5, l: 'S' }, { n: 6, l: 'S' }];

function vazio(usuarioId: string): FormInput {
  return { usuario_id: usuarioId, titulo: '', data: '', hora: '', recorrencia: 'nenhuma', dias_semana: [], antecedencia_min: 30, descricao: '' };
}

export default function AgendaPage() {
  const [ctx, setCtx] = useState<ContextoAgenda | null>(null);
  const [escopo, setEscopo] = useState<string>('todos'); // usuario_id filtro (admin) ou o próprio
  const [itens, setItens] = useState<Compromisso[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormInput | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  const recarregar = useCallback(async (esc: string) => {
    setLoading(true);
    setItens(await listarCompromissos(esc as string | 'todos'));
    setLoading(false);
  }, []);

  useEffect(() => {
    carregarContexto().then((c) => {
      setCtx(c);
      const esc = c.isAdmin ? 'todos' : (c.meuUsuarioId ?? 'todos');
      setEscopo(esc);
      recarregar(esc);
    });
  }, [recarregar]);

  const nomeDoUsuario = (id: string) => ctx?.usuarios.find((u) => u.id === id)?.nome ?? '';

  const abrirNovo = () => {
    const dono = ctx?.isAdmin ? (escopo !== 'todos' ? escopo : (ctx.usuarios[0]?.id ?? '')) : (ctx?.meuUsuarioId ?? '');
    setForm(vazio(dono)); setEditId(null); setErro('');
  };

  const abrirEdicao = (c: Compromisso) => {
    const { data, hora } = partesInstanteSP(c.inicio_em);
    setForm({
      usuario_id: c.usuario_id, titulo: c.titulo, data, hora,
      recorrencia: c.recorrencia, dias_semana: c.dias_semana ?? [],
      antecedencia_min: c.antecedencia_min, descricao: c.descricao ?? '',
    });
    setEditId(c.id); setErro('');
  };

  const salvar = async () => {
    if (!form) return;
    if (!form.titulo || !form.data || !form.hora) { setErro('Título, data e hora são obrigatórios.'); return; }
    const r = editId ? await atualizarCompromisso(editId, form) : await criarCompromisso(form);
    if (r.error) { setErro(r.error); return; }
    setForm(null); setEditId(null);
    recarregar(escopo);
  };

  const remover = async (id: string) => {
    if (!confirm('Remover este compromisso?')) return;
    await removerCompromisso(id);
    recarregar(escopo);
  };

  const trocarEscopo = (esc: string) => { setEscopo(esc); recarregar(esc); };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="admin-page-title" style={{ marginBottom: 0 }}>Agenda</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {ctx?.isAdmin && (
            <select value={escopo} onChange={(e) => trocarEscopo(e.target.value)}
              style={{ padding: '0.45rem 0.7rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', color: 'var(--gold-100)', fontFamily: 'inherit', fontSize: '0.8rem' }}>
              <option value="todos">Todos</option>
              {ctx.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          )}
          <button onClick={abrirNovo} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--gold-300)', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'var(--font-jetbrains)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            <Plus size={14} /> Novo
          </button>
        </div>
      </div>

      {form && (
        <div className="dash-card" style={{ padding: '1.2rem', marginBottom: '1.2rem', display: 'grid', gap: '0.7rem' }}>
          {erro && <div className="login-error">{erro}</div>}
          {ctx?.isAdmin && (
            <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.72rem', color: 'var(--text-dim)' }}>Para
              <select value={form.usuario_id} onChange={(e) => setForm({ ...form, usuario_id: e.target.value })}
                style={{ padding: '0.45rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', color: 'var(--gold-100)' }}>
                {ctx.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </label>
          )}
          <input placeholder="Título" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', color: 'var(--gold-100)' }} />
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })}
              style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', color: 'var(--gold-100)' }} />
            <input type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })}
              style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', color: 'var(--gold-100)' }} />
            <select value={form.recorrencia} onChange={(e) => setForm({ ...form, recorrencia: e.target.value as FormInput['recorrencia'] })}
              style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', color: 'var(--gold-100)' }}>
              <option value="nenhuma">Única</option><option value="diaria">Diária</option><option value="semanal">Semanal</option>
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
              lembrar <input type="number" value={form.antecedencia_min} min={0}
                onChange={(e) => setForm({ ...form, antecedencia_min: Number(e.target.value) })}
                style={{ width: 64, padding: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', color: 'var(--gold-100)' }} /> min antes
            </label>
          </div>
          {form.recorrencia === 'semanal' && (
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              {DIAS.map((d) => {
                const on = form.dias_semana.includes(d.n);
                return <button key={d.n} type="button" onClick={() => setForm({ ...form, dias_semana: on ? form.dias_semana.filter((x) => x !== d.n) : [...form.dias_semana, d.n] })}
                  style={{ width: 34, height: 34, cursor: 'pointer', background: on ? 'rgba(184,130,107,0.2)' : 'none', border: '1px solid var(--border-subtle)', color: on ? 'var(--gold-300)' : 'var(--text-dim)' }}>{d.l}</button>;
              })}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={salvar} className="login-submit" style={{ width: 'auto', padding: '0.5rem 1.2rem' }}>{editId ? 'Salvar' : 'Criar'}</button>
            <button onClick={() => { setForm(null); setEditId(null); }} style={{ padding: '0.5rem 1.2rem', background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-dim)', cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? <p style={{ color: 'var(--text-dim)' }}>Carregando...</p>
        : itens.length === 0 ? <p style={{ color: 'var(--text-dim)' }}>Nenhum compromisso.</p>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {itens.map((c) => (
            <div key={c.id} className="dash-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.9rem 1.3rem' }}>
              <CalendarDays size={18} style={{ color: 'var(--gold-500)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'var(--gold-100)', fontSize: '0.9rem' }}>{c.titulo}</div>
                <div style={{ display: 'flex', gap: '0.8rem', fontSize: '0.72rem', color: 'var(--text-dim)', flexWrap: 'wrap' }}>
                  <span>{formatarInstanteSP(c.inicio_em)}</span>
                  {c.recorrencia !== 'nenhuma' && <span>{c.recorrencia}</span>}
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Clock size={11} /> {c.antecedencia_min}min</span>
                  {ctx?.isAdmin && escopo === 'todos' && <span>· {nomeDoUsuario(c.usuario_id)}</span>}
                </div>
              </div>
              <button onClick={() => abrirEdicao(c)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }} aria-label="Editar"><Pencil size={15} /></button>
              <button onClick={() => remover(c.id)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }} aria-label="Remover"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>}
    </>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` (sem erros).
```bash
git add "app/(app)/agenda/page.tsx"
git commit -m "feat(agenda): pagina /agenda com CRUD + seletor de usuario (admin)"
```

---

## Task 7: Scripts de deploy (provisionamento + verificação RLS)

**Files:**
- Create: `scripts/provisionar-usuario.mjs`
- Create: `scripts/verify-agenda-rls.mjs`

**Interfaces:**
- Consumes: env `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

- [ ] **Step 1: Script de provisionamento**

`scripts/provisionar-usuario.mjs`:
```js
// Cria (ou acha) um auth user por e-mail e liga usuarios.auth_user_id.
// Uso: node scripts/provisionar-usuario.mjs <email> <whatsapp_numero> [senha_temp]
import { createClient } from '@supabase/supabase-js';

const [, , email, numero, senha = 'Trocar@123'] = process.argv;
if (!email || !numero) { console.error('uso: node scripts/provisionar-usuario.mjs <email> <numero> [senha]'); process.exit(2); }

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// 1. cria o auth user (ou reusa se já existir)
let userId;
const { data: created, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
if (error && !/already/i.test(error.message)) { console.error('erro criando auth user:', error.message); process.exit(1); }
if (created?.user) userId = created.user.id;
if (!userId) {
  const { data: list } = await admin.auth.admin.listUsers();
  userId = list.users.find((u) => u.email === email)?.id;
}
if (!userId) { console.error('não consegui obter o id do auth user'); process.exit(1); }

// 2. liga usuarios.auth_user_id
const { error: upErr } = await admin.from('usuarios').update({ auth_user_id: userId }).eq('whatsapp_numero', numero.replace(/\D/g, ''));
if (upErr) { console.error('erro ligando usuarios.auth_user_id:', upErr.message); process.exit(1); }
console.log(`OK: ${email} (auth ${userId}) ligado ao usuarios numero ${numero}. Senha temp: ${senha}`);
```

- [ ] **Step 2: Script de verificação de RLS**

`scripts/verify-agenda-rls.mjs`:
```js
// Verifica o isolamento por-usuário logando como dois usuários.
// Uso: node scripts/verify-agenda-rls.mjs <adminEmail> <adminSenha> <henriqueEmail> <henriqueSenha>
import { createClient } from '@supabase/supabase-js';

const [, , aEmail, aSenha, hEmail, hSenha] = process.argv;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function sessao(email, senha) {
  const c = createClient(url, anon, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

const admin = await sessao(aEmail, aSenha);
const hen = await sessao(hEmail, hSenha);

const { data: adminVe } = await admin.from('agenda_compromissos').select('id, usuario_id');
const { data: henVe } = await hen.from('agenda_compromissos').select('id, usuario_id');
const { data: henUsuarios } = await hen.from('usuarios').select('id, nome');

const donosHen = new Set((henVe ?? []).map((r) => r.usuario_id));
console.log(`admin enxerga ${adminVe?.length ?? 0} compromissos (de ${new Set((adminVe??[]).map(r=>r.usuario_id)).size} usuarios)`);
console.log(`henrique enxerga ${henVe?.length ?? 0} compromissos (de ${donosHen.size} usuario) e ${henUsuarios?.length ?? 0} linha(s) de usuarios`);

const falhas = [];
if (donosHen.size > 1) falhas.push('Henrique enxerga compromissos de mais de um usuario (VAZAMENTO)');
if ((henUsuarios?.length ?? 0) > 1) falhas.push('Henrique enxerga mais de uma linha em usuarios (VAZAMENTO)');
// tentativa de escrita cruzada: Henrique cria como outro dono
const outro = (adminVe ?? []).map((r) => r.usuario_id).find((id) => !donosHen.has(id));
if (outro) {
  const { error } = await hen.from('agenda_compromissos').insert({ usuario_id: outro, titulo: '__probe__', inicio_em: new Date().toISOString() });
  if (!error) falhas.push('Henrique CONSEGUIU criar compromisso como outro dono (VAZAMENTO)');
}
if (falhas.length) { console.error('FALHOU:\n- ' + falhas.join('\n- ')); process.exit(1); }
console.log('OK: isolamento por-usuario verificado.');
```

- [ ] **Step 3: Typecheck (não aplica a .mjs) + commit**

```bash
git add scripts/provisionar-usuario.mjs scripts/verify-agenda-rls.mjs
git commit -m "chore(agenda): scripts de provisionamento e verificacao de RLS"
```

---

## Task 8: Menu admin + verificação end-to-end

**Files:**
- Modify: `app/(admin)/layout.tsx`

- [ ] **Step 1: Adicionar "Agenda" ao menu admin**

Em `app/(admin)/layout.tsx`, no array `navItems`, adicionar (import `CalendarDays` de `lucide-react` no topo):
```ts
  { href: '/agenda', label: 'Agenda', icon: CalendarDays },
```
(colocar após o item Dashboard).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build conclui sem erro de tipo/rota (valida as novas páginas e o proxy).

- [ ] **Step 3: Verificação manual (local, com migration aplicada num Supabase de teste OU descrita para o deploy)**

Como a migration não está aplicada localmente, a verificação end-to-end acontece no deploy (ver checklist). Localmente, garantir apenas que `npm run build` passa. Registrar no PR os passos manuais pós-deploy:
- Login como Valmir → vê "Agenda" no menu; `/agenda` mostra seletor e ambas as agendas.
- Login como Henrique → vê só "Agenda + Sair"; `/agenda` mostra só a dele; `/leads` redireciona para `/login`.
- Criar às 15:00 → aparece 15:00; conferir no banco `inicio_em` = 18:00Z.
- Rodar `node scripts/verify-agenda-rls.mjs ...` → "OK: isolamento verificado".

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/layout.tsx"
git commit -m "feat(agenda): link Agenda no menu admin"
```

---

## Checklist de deploy (ordenado — `/security-review` antes)

- [ ] `npm run build` verde e `npx tsc --noEmit` limpo.
- [ ] **Rodar `/security-review`** na migration 002 + `proxy.ts` + `agenda-data.ts` (é o pedaço que, se errar, vaza dados entre usuários).
- [ ] Provisionar o Henrique: `node scripts/provisionar-usuario.mjs <email-do-henrique> 5543998588384` (guardar a senha temp e passar pra ele trocar).
- [ ] Rodar `db/migrations/002_agenda_rls_per_user.sql` no SQL Editor do Supabase. Conferir `select nome, auth_user_id from usuarios;` (Valmir e Henrique com auth_user_id preenchido).
- [ ] `node scripts/verify-agenda-rls.mjs <valmirEmail> <valmirSenha> <henriqueEmail> <henriqueSenha>` → "OK".
- [ ] Push da branch → PR → merge na `main` (Vercel auto-deploya).
- [ ] Verificação manual pós-deploy (os 4 passos da Task 8/Step 3).

---

## Self-review (feito)

- **Cobertura da spec:** RLS por-usuário + auth_user_id + current_usuario_id (T1); acesso de rota (T2); fuso SP (T3); dados/CRUD cliente+RLS (T4); layout mínimo Henrique (T5); página /agenda + seletor admin (T6); provisionamento + verificação RLS (T7); menu admin + verificação (T8). Fonte única (mesmas tabelas) é intrínseca à T4. `/security-review` no checklist.
- **Placeholders:** nenhum — SQL/TS/JS reais em cada passo.
- **Consistência de tipos:** `Compromisso`, `ContextoAgenda`, `FormInput`, `carregarContexto`, `listar/criar/atualizar/removerCompromisso`, `spParaInstante`/`formatarInstanteSP`/`partesInstanteSP` usados coerentemente entre T3/T4/T6.
- **Nota de teste:** feature UI+RLS — verificação é build + script de isolamento (T7) + checagem manual pós-deploy, não unit TDD (não há valor em test runner p/ duas funções de data triviais; o risco real, a RLS, tem script dedicado).
