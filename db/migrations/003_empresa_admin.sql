-- ============================================================
-- 003_empresa_admin.sql — Página administrativa da empresa (/empresa).
--
-- Quatro tabelas novas, TODAS admin-only. Dinheiro sempre em centavos
-- (integer), igual ao resto do app (lib/format.ts::formatBRL).
--
-- Sem bloco `do $$ ... $$`: o SQL Editor do Supabase quebra o script nos
-- `;` internos do bloco ("syntax error at end of input").
--
-- RODAR NO SQL EDITOR ANTES DO DEPLOY DO CÓDIGO QUE USA ESTAS TABELAS.
-- Idempotente.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. empresa_dados — registro ÚNICO (a PJ do Valmir).
--    Portais e documentos são jsonb: listas curtas, lidas só por esta
--    tela. Uma tabela a menos é uma policy de RLS a menos para errar.
--    NENHUMA SENHA aqui — só nome, url e login.
-- ------------------------------------------------------------
create table if not exists public.empresa_dados (
  id                     uuid primary key default gen_random_uuid(),
  razao_social           text,
  nome_fantasia          text,
  cnpj                   text,
  inscricao_estadual     text,
  inscricao_municipal    text,
  cnae_principal         text,
  cnaes_secundarios      text[] not null default '{}',
  regime_tributario      text not null default 'simples_nacional',
  data_abertura          date,
  capital_social_centavos integer,
  endereco               jsonb not null default '{}'::jsonb,  -- {logradouro,numero,complemento,bairro,cidade,uf,cep}
  contador               jsonb not null default '{}'::jsonb,  -- {nome,escritorio,telefone,email,dia_fechamento}
  certificado            jsonb not null default '{}'::jsonb,  -- {tipo,emissor,validade}
  portais                jsonb not null default '[]'::jsonb,  -- [{nome,url,login}]
  documentos             jsonb not null default '[]'::jsonb,  -- [{nome,url}]
  cotacao_usd_centavos   integer not null default 500,
  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. empresa_obrigacoes — o MODELO recorrente (cadastrado uma vez).
-- ------------------------------------------------------------
create table if not exists public.empresa_obrigacoes (
  id                    uuid primary key default gen_random_uuid(),
  nome                  text not null,
  categoria             text not null default 'fiscal'
                          check (categoria in ('fiscal','contabil','trabalhista','societaria')),
  orgao                 text,
  periodicidade         text not null default 'mensal'
                          check (periodicidade in ('mensal','trimestral','anual','unica')),
  dia_vencimento        integer check (dia_vencimento between 1 and 31),
  mes_vencimento        integer check (mes_vencimento between 1 and 12),  -- anual/trimestral: mês âncora
  vencimento_unico      date,                                             -- só para periodicidade 'unica'
  valor_padrao_centavos integer,                                          -- null = valor variável (ex.: DAS)
  link_portal           text,
  observacoes           text,
  ativo                 boolean not null default true,
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. empresa_obrigacao_ocorrencias — a INSTÂNCIA de um período.
--    A unicidade (obrigacao_id, competencia) é o que torna a
--    materialização idempotente: rodar 10x cria 1x.
--    "atrasada" NÃO é status: é derivado (vencimento < hoje + pendente).
-- ------------------------------------------------------------
create table if not exists public.empresa_obrigacao_ocorrencias (
  id              uuid primary key default gen_random_uuid(),
  obrigacao_id    uuid not null references public.empresa_obrigacoes(id) on delete cascade,
  competencia     date not null,          -- sempre o dia 1 do mês de referência
  vencimento      date not null,
  valor_centavos  integer,                -- null enquanto o contador não informa
  status          text not null default 'pendente'
                    check (status in ('pendente','paga','dispensada')),
  pago_em         date,
  comprovante_url text,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

create unique index if not exists empresa_ocorrencia_unica
  on public.empresa_obrigacao_ocorrencias (obrigacao_id, competencia);
create index if not exists empresa_ocorrencia_competencia
  on public.empresa_obrigacao_ocorrencias (competencia);

-- ------------------------------------------------------------
-- 4. empresa_custos_fixos — assinaturas e ferramentas.
-- ------------------------------------------------------------
create table if not exists public.empresa_custos_fixos (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  categoria      text,
  valor_centavos integer not null,
  moeda          text not null default 'BRL' check (moeda in ('BRL','USD')),
  ciclo          text not null default 'mensal' check (ciclo in ('mensal','anual')),
  dia_cobranca   integer check (dia_cobranca between 1 and 31),
  url            text,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 5. Espelho na agenda: a ocorrência vira compromisso do Valmir, e o
--    cron de lembretes que JÁ EXISTE avisa no WhatsApp. O painel é o
--    único escritor; a Sofia só lê.
--    Índice único garante 1 compromisso por ocorrência (idempotente).
-- ------------------------------------------------------------
alter table public.agenda_compromissos
  add column if not exists origem    text,
  add column if not exists origem_id uuid;

create unique index if not exists agenda_origem_unica
  on public.agenda_compromissos (origem, origem_id)
  where origem is not null;

-- ------------------------------------------------------------
-- 6. RLS — admin-only nas quatro. `enable` explícito: policy sem enable
--    é no-op silencioso e deixa a tabela ABERTA.
-- ------------------------------------------------------------
alter table public.empresa_dados                 enable row level security;
alter table public.empresa_obrigacoes            enable row level security;
alter table public.empresa_obrigacao_ocorrencias enable row level security;
alter table public.empresa_custos_fixos          enable row level security;

drop policy if exists empresa_admin_all on public.empresa_dados;
create policy empresa_admin_all on public.empresa_dados
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists empresa_admin_all on public.empresa_obrigacoes;
create policy empresa_admin_all on public.empresa_obrigacoes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists empresa_admin_all on public.empresa_obrigacao_ocorrencias;
create policy empresa_admin_all on public.empresa_obrigacao_ocorrencias
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists empresa_admin_all on public.empresa_custos_fixos;
create policy empresa_admin_all on public.empresa_custos_fixos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.empresa_dados                 from anon;
revoke all on public.empresa_obrigacoes            from anon;
revoke all on public.empresa_obrigacao_ocorrencias from anon;
revoke all on public.empresa_custos_fixos          from anon;

grant select, insert, update, delete on public.empresa_dados                 to authenticated;
grant select, insert, update, delete on public.empresa_obrigacoes            to authenticated;
grant select, insert, update, delete on public.empresa_obrigacao_ocorrencias to authenticated;
grant select, insert, update, delete on public.empresa_custos_fixos          to authenticated;

-- Semeia o registro único da empresa (vazio) se ainda não existir.
insert into public.empresa_dados (razao_social)
select null
where not exists (select 1 from public.empresa_dados);

commit;
