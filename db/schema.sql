-- ============================================
-- VVeronez.Dev — Schema Supabase Unificado
-- Inclui: Auth (users), Sofia (leads, ficha, mensagens, propostas), Agenor
-- Rodar no SQL Editor do Supabase Dashboard
-- ============================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================
-- AUTH — Tabela de usuarios
-- ============================================

create table if not exists public.users (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  nome text,
  is_admin boolean default false,
  created_at timestamptz default now()
);

alter table public.users enable row level security;
create policy "Users can read own data" on public.users
  for select using (auth.uid() = id);
create policy "Admins can read all users" on public.users
  for select using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- ENUMS — Sofia
-- ============================================

do $$ begin
  create type lead_status as enum ('aguardando_primeira_mensagem','em_andamento','finalizado','pausado','arquivado','negado');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type lead_temperatura as enum ('quente','morno','frio');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type ficha_campo as enum ('nome_cliente','tipo_projeto','problema_objetivo','estagio_atual','tamanho_escala','prazo','investimento','decisao_contexto','observacoes_extras');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type ficha_confianca as enum ('alta','media','baixa');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type frase_categoria as enum ('dor','objetivo','frustracao','ambicao','contexto_negocio','outro');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type mensagem_origem as enum ('cliente','sofia','sistema');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type mensagem_tipo as enum ('texto','audio','imagem','documento','tool_call','tool_result');
exception when duplicate_object then null;
end $$;

-- ============================================
-- SOFIA — Leads
-- ============================================

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  whatsapp_numero text unique not null,
  nome_cliente text,
  status lead_status not null default 'aguardando_primeira_mensagem',
  temperatura lead_temperatura,
  resumo_executivo text,
  justificativa_temperatura text,
  tipo_solucao_sugerida text,
  alertas text,
  proxima_acao_sugerida text,
  total_mensagens int default 0,
  total_tokens_consumidos int default 0,
  custo_estimado_centavos int default 0,
  ultima_mensagem_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finalizado_em timestamptz,
  arquivado_em timestamptz
);

create index if not exists idx_leads_status on leads(status) where arquivado_em is null;
create index if not exists idx_leads_created on leads(created_at desc);

alter table leads enable row level security;
create policy "Admins manage leads" on leads
  for all using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

-- ============================================
-- SOFIA — Projetos (dentro de um lead)
-- ============================================

create table if not exists projetos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  nome text not null,
  descricao text,
  relacao_outros_projetos text,
  ordem int default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_projetos_lead on projetos(lead_id);

alter table projetos enable row level security;
create policy "Admins manage projetos" on projetos
  for all using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

-- ============================================
-- SOFIA — Ficha de campos (append-only)
-- ============================================

create table if not exists ficha_campos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  projeto_id uuid references projetos(id) on delete cascade,
  campo ficha_campo not null,
  valor_estruturado text not null,
  frase_original text,
  confianca ficha_confianca not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ficha_campos_lead on ficha_campos(lead_id);

alter table ficha_campos enable row level security;
create policy "Admins manage ficha" on ficha_campos
  for all using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

-- View: versao mais recente de cada campo
create or replace view ficha_atual as
select distinct on (lead_id, campo)
  lead_id, campo, valor_estruturado, frase_original, confianca, created_at
from ficha_campos
order by lead_id, campo, created_at desc;

-- ============================================
-- SOFIA — Frases de ouro
-- ============================================

create table if not exists frases_ouro (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  frase text not null,
  categoria frase_categoria not null,
  por_que_importa text,
  created_at timestamptz not null default now()
);

alter table frases_ouro enable row level security;
create policy "Admins manage frases" on frases_ouro
  for all using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

-- ============================================
-- SOFIA — Mensagens
-- ============================================

create table if not exists mensagens (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  origem mensagem_origem not null,
  tipo mensagem_tipo not null default 'texto',
  conteudo text not null,
  audio_url text,
  audio_transcrito text,
  audio_duracao_segundos int,
  tool_name text,
  tool_input jsonb,
  tool_use_id text,
  tool_result jsonb,
  whatsapp_message_id text,
  metadados jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_mensagens_lead on mensagens(lead_id, created_at);

alter table mensagens enable row level security;
create policy "Admins manage mensagens" on mensagens
  for all using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

-- ============================================
-- SOFIA — Propostas
-- ============================================

create table if not exists propostas (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  projeto_id uuid references projetos(id) on delete cascade,
  status text default 'gerando' check (status in ('gerando','pronta','revisada','aprovada','enviada')),
  resumo text,
  stack_recomendada jsonb,
  cronograma jsonb,
  total_horas int default 0,
  valor_hora_centavos int default 5000,
  custo_dev_centavos int default 0,
  custo_fixo_centavos int default 100000,
  custo_servicos_mensal_centavos int default 0,
  custo_total_centavos int default 0,
  riscos text,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table propostas enable row level security;
create policy "Admins manage propostas" on propostas
  for all using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

create table if not exists proposta_modulos (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid references propostas(id) on delete cascade not null,
  nome text not null,
  descricao text,
  complexidade text check (complexidade in ('simples','medio','complexo')),
  horas_estimadas int default 0,
  fase text check (fase in ('mvp','v1','v2')),
  ordem int default 0,
  created_at timestamptz default now()
);

alter table proposta_modulos enable row level security;
create policy "Admins manage modulos" on proposta_modulos
  for all using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

create table if not exists proposta_servicos (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid references propostas(id) on delete cascade not null,
  nome text not null,
  descricao text,
  custo_mensal_centavos int default 0,
  obrigatorio boolean default true,
  created_at timestamptz default now()
);

alter table proposta_servicos enable row level security;
create policy "Admins manage servicos" on proposta_servicos
  for all using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

-- ============================================
-- SOFIA — Notificacoes e Eventos
-- ============================================

create table if not exists notificacoes_valmir (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  canal text not null default 'whatsapp',
  conteudo text not null,
  enviada_em timestamptz,
  erro text,
  created_at timestamptz not null default now()
);

alter table notificacoes_valmir enable row level security;
create policy "Admins manage notificacoes" on notificacoes_valmir
  for all using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

create table if not exists eventos_sistema (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  tipo text not null,
  descricao text,
  payload jsonb,
  nivel text not null default 'info',
  created_at timestamptz not null default now()
);

alter table eventos_sistema enable row level security;
create policy "Admins manage eventos" on eventos_sistema
  for all using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

-- ============================================
-- AGENOR — Propostas independentes
-- ============================================

create table if not exists agenor_proposals (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  briefing text not null,
  scope jsonb not null default '{}'::jsonb,
  pricing jsonb not null default '{}'::jsonb,
  timeline jsonb not null default '{}'::jsonb,
  status text default 'draft',
  pdf_url text,
  created_at timestamptz default now(),
  sent_at timestamptz
);

alter table agenor_proposals enable row level security;
create policy "Admins manage agenor_proposals" on agenor_proposals
  for all using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

-- ============================================
-- TRIGGERS
-- ============================================

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_leads_updated_at
  before update on leads
  for each row execute function update_updated_at();

create or replace function update_lead_contadores()
returns trigger language plpgsql as $$
begin
  update leads
  set total_mensagens = total_mensagens + 1, ultima_mensagem_em = new.created_at
  where id = new.lead_id;
  return new;
end;
$$;

create trigger trg_mensagens_atualiza_lead
  after insert on mensagens
  for each row execute function update_lead_contadores();
