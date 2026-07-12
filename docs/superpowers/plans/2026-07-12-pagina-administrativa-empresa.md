# Página Administrativa da Empresa — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a rota admin-only `/empresa` com três abas — identidade da PJ, obrigações legais com prazos/status, e custo fixo mensal — espelhando cada obrigação como compromisso na agenda para que a Sofia avise no WhatsApp sem código novo de lembrete.

**Architecture:** Quatro tabelas novas com prefixo `empresa_`, todas RLS `is_admin()`. As obrigações são cadastradas como **modelo recorrente** e **materializadas** em ocorrências mensais de forma idempotente (unique em `(obrigacao_id, competencia)`), disparada ao abrir a página — sem cron novo. A lógica de calendário, status e soma de custo vive em módulos puros (`lib/obrigacoes.ts`, `lib/custos.ts`) testados com vitest; o acesso a dados fica em `lib/empresa-data.ts`, espelhando o padrão de `lib/agenda-data.ts`.

**Tech Stack:** Next.js 16 (App Router, client components), TypeScript strict, Supabase (`@supabase/ssr`), vitest, lucide-react, CSS existente em `globals.css`.

**Spec:** `docs/superpowers/specs/2026-07-12-pagina-administrativa-empresa-design.md`

## Global Constraints

- **Dinheiro é sempre inteiro em centavos.** `lib/format.ts` expõe `formatBRL(centavos)`. Nenhuma coluna `numeric` de dinheiro — colunas `*_centavos integer`. A cotação do dólar também: `cotacao_usd_centavos` (542 = R$ 5,42).
- **RLS habilitada explicitamente** em toda tabela nova (`enable row level security`). Policy sem isso é no-op silencioso e a tabela fica aberta. Sempre `revoke all ... from anon`.
- **Nenhuma senha no banco** (portais, certificado, gov.br). Só nome, URL e login.
- **Migrations são aplicadas manualmente** no SQL Editor do Supabase, **antes** do push do código que as usa.
- **Sem bloco `do $$ ... $$`** no SQL: o SQL Editor do Supabase quebra o script nos `;` internos. Usar tag única (`$fn$`) em corpo de função.
- **Nada de commit/merge sem revisão do Valmir. Deploy só com autorização explícita.**
- **Antes de qualquer push:** `npx tsc --noEmit` **e** `npm run build` verdes. Dev server local na porta **3333**.
- **A rota `/empresa` NÃO entra em `AUTENTICADO_PREFIXES` do `lib/supabase/proxy.ts`** — rota nova nasce admin-only por deny-by-default. Não tocar no proxy.
- Texto de UI em pt-BR.
- **Pré-requisito:** a sessão paralela que mexe na Agenda/Sofia precisa ter feito merge antes da Task 5 (que escreve em `agenda_compromissos`).

---

### Task 1: Migration — tabelas, RLS e colunas de espelho

**Files:**
- Create: `db/migrations/003_empresa_admin.sql`
- Create: `scripts/verify-empresa-rls.mjs`

**Interfaces:**
- Consumes: `public.is_admin()` (de `001_rls_lockdown.sql`), `public.agenda_compromissos` (da migration da Sofia).
- Produces: tabelas `empresa_dados`, `empresa_obrigacoes`, `empresa_obrigacao_ocorrencias`, `empresa_custos_fixos`; colunas `agenda_compromissos.origem` e `.origem_id`; índice único `(obrigacao_id, competencia)`.

- [ ] **Step 1: Escrever a migration**

Create `db/migrations/003_empresa_admin.sql`:

```sql
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
```

- [ ] **Step 2: Aplicar a migration no Supabase**

O Valmir cola o conteúdo no SQL Editor do Supabase e roda. Esperado: `Success. No rows returned`.
Não seguir sem isso — o código das tasks seguintes depende das tabelas.

- [ ] **Step 3: Escrever o script de verificação de RLS**

Prova por **identidade e por rejeição de escrita**, não por contagem — contagem dá falso "OK".

Create `scripts/verify-empresa-rls.mjs`:

```js
// Verifica que as tabelas empresa_* são ADMIN-ONLY.
// Detecção ativa: o usuário comum TENTA ler e TENTA escrever. Se conseguir, é vazamento.
// Uso: node scripts/verify-empresa-rls.mjs <adminEmail> <adminSenha> <comumEmail> <comumSenha>
import { createClient } from '@supabase/supabase-js';

const [, , aEmail, aSenha, cEmail, cSenha] = process.argv;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TABELAS = ['empresa_dados', 'empresa_obrigacoes', 'empresa_obrigacao_ocorrencias', 'empresa_custos_fixos'];

async function sessao(email, senha) {
  const c = createClient(url, anon, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

const admin = await sessao(aEmail, aSenha);
const comum = await sessao(cEmail, cSenha);
const anonimo = createClient(url, anon, { auth: { persistSession: false } });

const falhas = [];

// 1. O admin PRECISA enxergar empresa_dados — se nem ele vê, a policy está errada
//    e o "zero linhas" do comum seria um falso OK.
const { data: adminVe, error: adminErro } = await admin.from('empresa_dados').select('id');
if (adminErro) falhas.push(`admin NAO consegue ler empresa_dados (${adminErro.message}) — policy quebrada`);
else if ((adminVe ?? []).length === 0) falhas.push('admin le 0 linhas de empresa_dados — o seed da migration nao rodou; nao posso provar isolamento');
else console.log(`admin enxerga ${adminVe.length} linha(s) de empresa_dados`);

// 2. Leitura: comum e anônimo têm que enxergar ZERO em todas as tabelas.
for (const t of TABELAS) {
  const { data: cVe } = await comum.from(t).select('id');
  if ((cVe ?? []).length > 0) falhas.push(`usuario comum enxerga ${cVe.length} linha(s) de ${t} (VAZAMENTO)`);
  const { data: aVe } = await anonimo.from(t).select('id');
  if ((aVe ?? []).length > 0) falhas.push(`ANONIMO enxerga ${aVe.length} linha(s) de ${t} (VAZAMENTO GRAVE)`);
}

// 3. Escrita: o comum tem que ser REJEITADO. "Nao aparecer" nao basta.
const { error: escritaComum } = await comum
  .from('empresa_custos_fixos').insert({ nome: '__probe__', valor_centavos: 1 });
if (!escritaComum) falhas.push('usuario comum CONSEGUIU inserir em empresa_custos_fixos (VAZAMENTO)');

const { error: escritaAnon } = await anonimo
  .from('empresa_custos_fixos').insert({ nome: '__probe_anon__', valor_centavos: 1 });
if (!escritaAnon) falhas.push('ANONIMO CONSEGUIU inserir em empresa_custos_fixos (VAZAMENTO GRAVE)');

// Limpeza dos probes (se algum passou, precisa sumir).
if (service) {
  const svc = createClient(url, service, { auth: { persistSession: false } });
  await svc.from('empresa_custos_fixos').delete().in('nome', ['__probe__', '__probe_anon__']);
} else {
  console.warn('AVISO: SUPABASE_SERVICE_ROLE_KEY ausente — nao limpei eventuais linhas __probe__.');
}

if (falhas.length) { console.error('FALHOU:\n- ' + falhas.join('\n- ')); process.exit(1); }
console.log('OK: tabelas empresa_* sao admin-only (leitura e escrita verificadas por rejeicao ativa).');
```

- [ ] **Step 4: Rodar o script e verificar que passa**

Run (com as env vars do `.env.local` carregadas):
```bash
node scripts/verify-empresa-rls.mjs veronezrepresentacoes@gmail.com <senha-admin> henriquefilho185@gmail.com <senha-henrique>
```
Expected: `OK: tabelas empresa_* sao admin-only (leitura e escrita verificadas por rejeicao ativa).`

Se falhar com "admin le 0 linhas": a migration não foi aplicada ou o seed não rodou. Voltar ao Step 2.

- [ ] **Step 5: Commit**

```bash
git add db/migrations/003_empresa_admin.sql scripts/verify-empresa-rls.mjs
git commit -m "feat(empresa): tabelas admin-only + verificacao de RLS por rejeicao ativa"
```

---

### Task 2: Calendário e status das obrigações (módulo puro)

Toda a matemática de datas isolada e testada, sem banco. Aqui mora o bug clássico: **dia 31 em fevereiro**.

**Files:**
- Create: `lib/obrigacoes.ts`
- Test: `lib/obrigacoes.test.ts`

**Interfaces:**
- Consumes: nada (módulo puro).
- Produces:
  - `type Periodicidade = 'mensal' | 'trimestral' | 'anual' | 'unica'`
  - `type StatusPersistido = 'pendente' | 'paga' | 'dispensada'`
  - `type StatusExibido = StatusPersistido | 'atrasada'`
  - `interface ModeloObrigacao { id: string; nome: string; categoria: string; orgao: string | null; periodicidade: Periodicidade; dia_vencimento: number | null; mes_vencimento: number | null; vencimento_unico: string | null; valor_padrao_centavos: number | null; link_portal: string | null; observacoes: string | null; ativo: boolean }`
  - `interface Ocorrencia { id: string; obrigacao_id: string; competencia: string; vencimento: string; valor_centavos: number | null; status: StatusPersistido; pago_em: string | null; comprovante_url: string | null }`
  - `interface NovaOcorrencia { obrigacao_id: string; competencia: string; vencimento: string; valor_centavos: number | null }`
  - `competenciaDe(iso: string): string`
  - `vencimentoNaCompetencia(modelo: ModeloObrigacao, competencia: string): string | null`
  - `planoDeMaterializacao(modelos: ModeloObrigacao[], competencia: string): NovaOcorrencia[]`
  - `statusExibido(o: Ocorrencia, hojeISO: string): StatusExibido`
  - `venceEmDias(o: Ocorrencia, hojeISO: string): number`

- [ ] **Step 1: Escrever os testes que falham**

Create `lib/obrigacoes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  competenciaDe, vencimentoNaCompetencia, planoDeMaterializacao, statusExibido, venceEmDias,
  type ModeloObrigacao, type Ocorrencia,
} from './obrigacoes';

const modelo = (m: Partial<ModeloObrigacao>): ModeloObrigacao => ({
  id: 'o1', nome: 'DAS', categoria: 'fiscal', orgao: 'Receita Federal',
  periodicidade: 'mensal', dia_vencimento: 20, mes_vencimento: null, vencimento_unico: null,
  valor_padrao_centavos: null, link_portal: null, observacoes: null, ativo: true, ...m,
});

const ocorrencia = (o: Partial<Ocorrencia>): Ocorrencia => ({
  id: 'oc1', obrigacao_id: 'o1', competencia: '2026-07-01', vencimento: '2026-07-20',
  valor_centavos: null, status: 'pendente', pago_em: null, comprovante_url: null, ...o,
});

describe('competenciaDe', () => {
  it('normaliza qualquer data para o dia 1 do mês', () => {
    expect(competenciaDe('2026-07-12')).toBe('2026-07-01');
    expect(competenciaDe('2026-07-01')).toBe('2026-07-01');
  });
});

describe('vencimentoNaCompetencia', () => {
  it('mensal cai no dia configurado', () => {
    expect(vencimentoNaCompetencia(modelo({ dia_vencimento: 20 }), '2026-07-01')).toBe('2026-07-20');
  });

  // O bug clássico: dia 31 não existe em fevereiro. Sem clamp, `new Date(2026,1,31)`
  // vira 3 de março e a obrigação venceria no mês errado.
  it('mensal com dia 31 em fevereiro é grudado no último dia do mês', () => {
    expect(vencimentoNaCompetencia(modelo({ dia_vencimento: 31 }), '2026-02-01')).toBe('2026-02-28');
  });

  it('mensal com dia 31 em ano bissexto respeita o 29', () => {
    expect(vencimentoNaCompetencia(modelo({ dia_vencimento: 31 }), '2028-02-01')).toBe('2028-02-29');
  });

  it('anual só vence no mês âncora', () => {
    const defis = modelo({ periodicidade: 'anual', mes_vencimento: 5, dia_vencimento: 31 });
    expect(vencimentoNaCompetencia(defis, '2026-05-01')).toBe('2026-05-31');
    expect(vencimentoNaCompetencia(defis, '2026-07-01')).toBeNull();
  });

  it('trimestral vence no mês âncora e de 3 em 3 meses', () => {
    const t = modelo({ periodicidade: 'trimestral', mes_vencimento: 1, dia_vencimento: 10 });
    expect(vencimentoNaCompetencia(t, '2026-01-01')).toBe('2026-01-10');
    expect(vencimentoNaCompetencia(t, '2026-04-01')).toBe('2026-04-10');
    expect(vencimentoNaCompetencia(t, '2026-03-01')).toBeNull();
  });

  it('única só vence na competência da própria data', () => {
    const u = modelo({ periodicidade: 'unica', dia_vencimento: null, vencimento_unico: '2026-09-15' });
    expect(vencimentoNaCompetencia(u, '2026-09-01')).toBe('2026-09-15');
    expect(vencimentoNaCompetencia(u, '2026-08-01')).toBeNull();
  });

  it('modelo inativo nunca vence', () => {
    expect(vencimentoNaCompetencia(modelo({ ativo: false }), '2026-07-01')).toBeNull();
  });
});

describe('planoDeMaterializacao', () => {
  it('gera uma ocorrência por modelo que vence no mês, com o valor padrão quando fixo', () => {
    const plano = planoDeMaterializacao([
      modelo({ id: 'das', valor_padrao_centavos: null }),
      modelo({ id: 'contador', dia_vencimento: 5, valor_padrao_centavos: 90000 }),
      modelo({ id: 'defis', periodicidade: 'anual', mes_vencimento: 5, dia_vencimento: 31 }),
    ], '2026-07-01');

    expect(plano).toEqual([
      { obrigacao_id: 'das', competencia: '2026-07-01', vencimento: '2026-07-20', valor_centavos: null },
      { obrigacao_id: 'contador', competencia: '2026-07-01', vencimento: '2026-07-05', valor_centavos: 90000 },
    ]);
  });

  it('mês sem nenhuma obrigação devida gera plano vazio', () => {
    const so_anual = modelo({ periodicidade: 'anual', mes_vencimento: 5, dia_vencimento: 31 });
    expect(planoDeMaterializacao([so_anual], '2026-07-01')).toEqual([]);
  });
});

describe('statusExibido', () => {
  it('paga continua paga mesmo com vencimento no passado', () => {
    expect(statusExibido(ocorrencia({ status: 'paga', vencimento: '2026-07-01' }), '2026-07-12')).toBe('paga');
  });

  it('dispensada nunca vira atrasada', () => {
    expect(statusExibido(ocorrencia({ status: 'dispensada', vencimento: '2026-07-01' }), '2026-07-12')).toBe('dispensada');
  });

  it('pendente com vencimento passado é atrasada (derivado, não persistido)', () => {
    expect(statusExibido(ocorrencia({ vencimento: '2026-07-10' }), '2026-07-12')).toBe('atrasada');
  });

  it('pendente vencendo HOJE ainda é pendente, não atrasada', () => {
    expect(statusExibido(ocorrencia({ vencimento: '2026-07-12' }), '2026-07-12')).toBe('pendente');
  });

  it('pendente com vencimento futuro é pendente', () => {
    expect(statusExibido(ocorrencia({ vencimento: '2026-07-20' }), '2026-07-12')).toBe('pendente');
  });
});

describe('venceEmDias', () => {
  it('conta dias até o vencimento; negativo quando já passou', () => {
    expect(venceEmDias(ocorrencia({ vencimento: '2026-07-20' }), '2026-07-12')).toBe(8);
    expect(venceEmDias(ocorrencia({ vencimento: '2026-07-12' }), '2026-07-12')).toBe(0);
    expect(venceEmDias(ocorrencia({ vencimento: '2026-07-10' }), '2026-07-12')).toBe(-2);
  });
});
```

- [ ] **Step 2: Rodar os testes e ver falhar**

Run: `npm test -- lib/obrigacoes.test.ts`
Expected: FAIL — `Failed to resolve import "./obrigacoes"`.

- [ ] **Step 3: Implementar o módulo**

Datas aqui são **strings `YYYY-MM-DD`, tratadas como data civil** — nunca `new Date(iso)` sem cuidado, porque `new Date('2026-07-20')` é UTC e no fuso -03:00 volta como dia 19. Usamos `Date.UTC` para a aritmética e formatamos de volta em UTC, o que mantém a data civil intacta.

Create `lib/obrigacoes.ts`:

```ts
// Calendário e status das obrigações da empresa. Módulo PURO — sem banco, sem React.
// Datas são strings YYYY-MM-DD (data civil). A aritmética roda em UTC de propósito:
// `new Date('2026-07-20')` é meia-noite UTC e, lido no fuso -03:00, viraria dia 19.

export type Periodicidade = 'mensal' | 'trimestral' | 'anual' | 'unica';
export type StatusPersistido = 'pendente' | 'paga' | 'dispensada';
export type StatusExibido = StatusPersistido | 'atrasada';

export interface ModeloObrigacao {
  id: string; nome: string; categoria: string; orgao: string | null;
  periodicidade: Periodicidade;
  dia_vencimento: number | null; mes_vencimento: number | null; vencimento_unico: string | null;
  valor_padrao_centavos: number | null; link_portal: string | null; observacoes: string | null;
  ativo: boolean;
}

export interface Ocorrencia {
  id: string; obrigacao_id: string; competencia: string; vencimento: string;
  valor_centavos: number | null; status: StatusPersistido;
  pago_em: string | null; comprovante_url: string | null;
}

export interface NovaOcorrencia {
  obrigacao_id: string; competencia: string; vencimento: string; valor_centavos: number | null;
}

const DIA_MS = 86_400_000;

function partes(iso: string): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = iso.slice(0, 10).split('-').map(Number);
  return { ano, mes, dia };
}

function iso(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Último dia do mês (28/29/30/31). Dia 0 do mês seguinte = último dia deste. */
function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** Normaliza qualquer data para o dia 1 do seu mês (a competência). */
export function competenciaDe(dataISO: string): string {
  const { ano, mes } = partes(dataISO);
  return iso(ano, mes, 1);
}

/** A data de vencimento do modelo nesta competência, ou null se ele não vence neste mês. */
export function vencimentoNaCompetencia(m: ModeloObrigacao, competencia: string): string | null {
  if (!m.ativo) return null;
  const { ano, mes } = partes(competencia);

  if (m.periodicidade === 'unica') {
    if (!m.vencimento_unico) return null;
    return competenciaDe(m.vencimento_unico) === competencia ? m.vencimento_unico.slice(0, 10) : null;
  }

  if (m.periodicidade === 'anual') {
    if (m.mes_vencimento !== mes) return null;
  }

  if (m.periodicidade === 'trimestral') {
    if (!m.mes_vencimento) return null;
    // Vence no mês âncora e de 3 em 3 meses a partir dele.
    if ((mes - m.mes_vencimento + 12) % 3 !== 0) return null;
  }

  if (!m.dia_vencimento) return null;
  // Clamp: dia 31 em fevereiro vira o último dia do mês, não 3 de março.
  const dia = Math.min(m.dia_vencimento, ultimoDiaDoMes(ano, mes));
  return iso(ano, mes, dia);
}

/** As ocorrências que DEVEM existir nesta competência. Idempotência é garantida pelo
 *  índice único (obrigacao_id, competencia) no banco — aqui só calculamos. */
export function planoDeMaterializacao(modelos: ModeloObrigacao[], competencia: string): NovaOcorrencia[] {
  const plano: NovaOcorrencia[] = [];
  for (const m of modelos) {
    const vencimento = vencimentoNaCompetencia(m, competencia);
    if (!vencimento) continue;
    plano.push({
      obrigacao_id: m.id,
      competencia,
      vencimento,
      valor_centavos: m.valor_padrao_centavos,
    });
  }
  return plano;
}

/** "atrasada" é DERIVADO, nunca gravado: status no banco dependeria de um cron que talvez não rode. */
export function statusExibido(o: Ocorrencia, hojeISO: string): StatusExibido {
  if (o.status !== 'pendente') return o.status;
  return venceEmDias(o, hojeISO) < 0 ? 'atrasada' : 'pendente';
}

/** Dias até o vencimento. 0 = vence hoje. Negativo = já passou. */
export function venceEmDias(o: Ocorrencia, hojeISO: string): number {
  const v = partes(o.vencimento), h = partes(hojeISO);
  const venc = Date.UTC(v.ano, v.mes - 1, v.dia);
  const hoje = Date.UTC(h.ano, h.mes - 1, h.dia);
  return Math.round((venc - hoje) / DIA_MS);
}
```

- [ ] **Step 4: Rodar os testes e ver passar**

Run: `npm test -- lib/obrigacoes.test.ts`
Expected: PASS — 14 testes verdes.

- [ ] **Step 5: Commit**

```bash
git add lib/obrigacoes.ts lib/obrigacoes.test.ts
git commit -m "feat(empresa): calendario e status das obrigacoes (modulo puro, com clamp de fim de mes)"
```

---

### Task 3: Custo fixo mensal (módulo puro)

**Files:**
- Create: `lib/custos.ts`
- Test: `lib/custos.test.ts`

**Interfaces:**
- Consumes: nada (módulo puro).
- Produces:
  - `interface CustoFixo { id: string; nome: string; categoria: string | null; valor_centavos: number; moeda: 'BRL' | 'USD'; ciclo: 'mensal' | 'anual'; dia_cobranca: number | null; url: string | null; ativo: boolean }`
  - `custoMensalEmBRL(c: CustoFixo, cotacaoUsdCentavos: number): number`
  - `custoFixoTotalMensal(custos: CustoFixo[], cotacaoUsdCentavos: number): number`
  - `custoObrigacoesMensal(modelos: ModeloObrigacao[]): number`

- [ ] **Step 1: Escrever os testes que falham**

Create `lib/custos.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { custoMensalEmBRL, custoFixoTotalMensal, custoObrigacoesMensal, type CustoFixo } from './custos';
import type { ModeloObrigacao } from './obrigacoes';

const custo = (c: Partial<CustoFixo>): CustoFixo => ({
  id: 'c1', nome: 'Vercel', categoria: 'infra', valor_centavos: 2000,
  moeda: 'BRL', ciclo: 'mensal', dia_cobranca: 1, url: null, ativo: true, ...c,
});

const modelo = (m: Partial<ModeloObrigacao>): ModeloObrigacao => ({
  id: 'o1', nome: 'Contador', categoria: 'contabil', orgao: null,
  periodicidade: 'mensal', dia_vencimento: 5, mes_vencimento: null, vencimento_unico: null,
  valor_padrao_centavos: 90000, link_portal: null, observacoes: null, ativo: true, ...m,
});

describe('custoMensalEmBRL', () => {
  it('BRL mensal passa direto', () => {
    expect(custoMensalEmBRL(custo({ valor_centavos: 2000 }), 542)).toBe(2000);
  });

  it('USD é convertido pela cotação (20 USD a R$ 5,42 = R$ 108,40)', () => {
    expect(custoMensalEmBRL(custo({ valor_centavos: 2000, moeda: 'USD' }), 542)).toBe(10840);
  });

  it('anual é diluído em 12 meses e arredondado para centavo inteiro', () => {
    // R$ 100,00/ano = R$ 8,33/mês (10000/12 = 833,33 → 833)
    expect(custoMensalEmBRL(custo({ valor_centavos: 10000, ciclo: 'anual' }), 542)).toBe(833);
  });

  it('USD anual: converte e depois dilui', () => {
    // 120 USD/ano a R$ 5,00 = R$ 600/ano = R$ 50/mês
    expect(custoMensalEmBRL(custo({ valor_centavos: 12000, moeda: 'USD', ciclo: 'anual' }), 500)).toBe(5000);
  });
});

describe('custoFixoTotalMensal', () => {
  it('soma só os ativos', () => {
    const total = custoFixoTotalMensal([
      custo({ id: 'a', valor_centavos: 2000 }),
      custo({ id: 'b', valor_centavos: 5000 }),
      custo({ id: 'c', valor_centavos: 99900, ativo: false }),
    ], 500);
    expect(total).toBe(7000);
  });

  it('lista vazia soma zero', () => {
    expect(custoFixoTotalMensal([], 500)).toBe(0);
  });
});

describe('custoObrigacoesMensal', () => {
  it('soma só obrigações mensais ativas de valor FIXO', () => {
    const total = custoObrigacoesMensal([
      modelo({ id: 'contador', valor_padrao_centavos: 90000 }),
      modelo({ id: 'das', valor_padrao_centavos: null }),          // variável: não entra
      modelo({ id: 'defis', periodicidade: 'anual', mes_vencimento: 5, valor_padrao_centavos: 30000 }), // não é mensal
      modelo({ id: 'velha', valor_padrao_centavos: 50000, ativo: false }),  // inativa
    ]);
    expect(total).toBe(90000);
  });
});
```

- [ ] **Step 2: Rodar os testes e ver falhar**

Run: `npm test -- lib/custos.test.ts`
Expected: FAIL — `Failed to resolve import "./custos"`.

- [ ] **Step 3: Implementar o módulo**

Create `lib/custos.ts`:

```ts
// Custo fixo de manter a empresa viva. Módulo PURO.
// Tudo em centavos inteiros (igual ao resto do app — lib/format.ts::formatBRL).
// A cotação do dólar é um número que o Valmir mantém à mão (cotacao_usd_centavos
// em empresa_dados): sem API externa, sem dependência que quebra de madrugada.

import type { ModeloObrigacao } from './obrigacoes';

export interface CustoFixo {
  id: string; nome: string; categoria: string | null;
  valor_centavos: number; moeda: 'BRL' | 'USD'; ciclo: 'mensal' | 'anual';
  dia_cobranca: number | null; url: string | null; ativo: boolean;
}

/** O quanto este custo pesa POR MÊS, em centavos de real. */
export function custoMensalEmBRL(c: CustoFixo, cotacaoUsdCentavos: number): number {
  const emBRL = c.moeda === 'USD'
    ? (c.valor_centavos * cotacaoUsdCentavos) / 100
    : c.valor_centavos;
  const mensal = c.ciclo === 'anual' ? emBRL / 12 : emBRL;
  return Math.round(mensal);
}

export function custoFixoTotalMensal(custos: CustoFixo[], cotacaoUsdCentavos: number): number {
  return custos
    .filter((c) => c.ativo)
    .reduce((soma, c) => soma + custoMensalEmBRL(c, cotacaoUsdCentavos), 0);
}

/** Obrigações entram no custo fixo só quando são mensais E têm valor conhecido.
 *  O DAS (valor variável) fica de fora: chutar um número aqui seria pior que omitir. */
export function custoObrigacoesMensal(modelos: ModeloObrigacao[]): number {
  return modelos
    .filter((m) => m.ativo && m.periodicidade === 'mensal' && m.valor_padrao_centavos != null)
    .reduce((soma, m) => soma + (m.valor_padrao_centavos ?? 0), 0);
}
```

- [ ] **Step 4: Rodar os testes e ver passar**

Run: `npm test -- lib/custos.test.ts`
Expected: PASS — 7 testes verdes.

- [ ] **Step 5: Commit**

```bash
git add lib/custos.ts lib/custos.test.ts
git commit -m "feat(empresa): calculo do custo fixo mensal (conversao USD + diluicao anual)"
```

---

### Task 4: Camada de dados — identidade e custos

Espelha o padrão de `lib/agenda-data.ts`: client component chama funções que falam com o Supabase via `createClient()` do browser, e a RLS faz a autorização.

**Files:**
- Create: `lib/empresa-data.ts`
- Test: `lib/empresa-data.test.ts`

**Interfaces:**
- Consumes: `@/lib/supabase/client`, `CustoFixo` (Task 3), `ModeloObrigacao` / `Ocorrencia` (Task 2).
- Produces:
  - `interface EmpresaDados { id: string; razao_social: string | null; nome_fantasia: string | null; cnpj: string | null; inscricao_estadual: string | null; inscricao_municipal: string | null; cnae_principal: string | null; cnaes_secundarios: string[]; regime_tributario: string; data_abertura: string | null; capital_social_centavos: number | null; endereco: Endereco; contador: Contador; certificado: Certificado; portais: Portal[]; documentos: Documento[]; cotacao_usd_centavos: number }`
  - `interface Endereco { logradouro?: string; numero?: string; complemento?: string; bairro?: string; cidade?: string; uf?: string; cep?: string }`
  - `interface Contador { nome?: string; escritorio?: string; telefone?: string; email?: string; dia_fechamento?: number }`
  - `interface Certificado { tipo?: 'A1' | 'A3'; emissor?: string; validade?: string }`
  - `interface Portal { nome: string; url: string; login: string }` — **sem campo de senha, de propósito**
  - `interface Documento { nome: string; url: string }`
  - `carregarEmpresa(): Promise<EmpresaDados | null>`
  - `salvarEmpresa(id: string, dados: Partial<EmpresaDados>): Promise<{ error: string | null }>`
  - `listarCustos(): Promise<CustoFixo[]>`
  - `salvarCusto(input: CustoInput, id?: string): Promise<{ error: string | null }>`
  - `removerCusto(id: string): Promise<{ error: string | null }>`
  - `type CustoInput = { nome: string; categoria: string; valor_reais: string; moeda: 'BRL' | 'USD'; ciclo: 'mensal' | 'anual'; dia_cobranca: number | null; url: string }`
  - `validarCusto(input: CustoInput): string | null`
  - `reaisParaCentavos(v: string): number | null`
  - `alertaCertificado(cert: Certificado, hojeISO: string): { dias: number; nivel: 'ok' | 'atencao' | 'vencido' } | null`

- [ ] **Step 1: Escrever os testes das funções puras**

Só as funções puras são testadas — as de I/O são exercitadas no fluxo real da Task 8. `reaisParaCentavos` existe porque o input do usuário é `"1.234,56"` e o banco quer `123456`.

Create `lib/empresa-data.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { reaisParaCentavos, validarCusto, alertaCertificado, type CustoInput } from './empresa-data';

const input = (c: Partial<CustoInput>): CustoInput => ({
  nome: 'Vercel', categoria: 'infra', valor_reais: '20,00',
  moeda: 'BRL', ciclo: 'mensal', dia_cobranca: 1, url: '', ...c,
});

describe('reaisParaCentavos', () => {
  it('aceita o formato brasileiro com vírgula', () => {
    expect(reaisParaCentavos('20,00')).toBe(2000);
    expect(reaisParaCentavos('1.234,56')).toBe(123456);
  });

  it('aceita ponto como decimal e valor inteiro', () => {
    expect(reaisParaCentavos('20.50')).toBe(2050);
    expect(reaisParaCentavos('20')).toBe(2000);
  });

  it('rejeita vazio e lixo', () => {
    expect(reaisParaCentavos('')).toBeNull();
    expect(reaisParaCentavos('abc')).toBeNull();
  });

  // Ponto flutuante: 20.15 * 100 = 2014.9999... Sem arredondar, o banco (integer) receberia 2014.
  it('arredonda o centavo em vez de truncar', () => {
    expect(reaisParaCentavos('20,15')).toBe(2015);
  });
});

describe('validarCusto', () => {
  it('custo válido passa', () => {
    expect(validarCusto(input({}))).toBeNull();
  });

  it('nome vazio é rejeitado', () => {
    expect(validarCusto(input({ nome: '  ' }))).toBe('Nome é obrigatório.');
  });

  it('valor inválido é rejeitado', () => {
    expect(validarCusto(input({ valor_reais: 'abc' }))).toBe('Valor inválido.');
  });

  it('dia de cobrança fora da faixa é rejeitado (o CHECK do banco é 1..31)', () => {
    expect(validarCusto(input({ dia_cobranca: 32 }))).toBe('Dia da cobrança deve ficar entre 1 e 31.');
    expect(validarCusto(input({ dia_cobranca: 0 }))).toBe('Dia da cobrança deve ficar entre 1 e 31.');
  });

  it('dia de cobrança vazio é aceito (é opcional)', () => {
    expect(validarCusto(input({ dia_cobranca: null }))).toBeNull();
  });
});

describe('alertaCertificado', () => {
  it('sem validade cadastrada não alerta', () => {
    expect(alertaCertificado({}, '2026-07-12')).toBeNull();
  });

  it('validade distante é ok', () => {
    expect(alertaCertificado({ validade: '2027-01-01' }, '2026-07-12')).toEqual({ dias: 173, nivel: 'ok' });
  });

  // Certificado vencido trava emissão de nota — o aviso precisa aparecer com folga.
  it('faltando 30 dias ou menos vira atenção', () => {
    expect(alertaCertificado({ validade: '2026-08-11' }, '2026-07-12')).toEqual({ dias: 30, nivel: 'atencao' });
  });

  it('vencido é vencido', () => {
    expect(alertaCertificado({ validade: '2026-07-11' }, '2026-07-12')).toEqual({ dias: -1, nivel: 'vencido' });
  });
});
```

- [ ] **Step 2: Rodar os testes e ver falhar**

Run: `npm test -- lib/empresa-data.test.ts`
Expected: FAIL — `Failed to resolve import "./empresa-data"`.

- [ ] **Step 3: Implementar a camada de dados (identidade + custos)**

Create `lib/empresa-data.ts`:

```ts
import { createClient } from '@/lib/supabase/client';
import type { CustoFixo } from '@/lib/custos';

// SEM campo de senha em Portal — decisão de segurança da spec: o endpoint de auth do
// Supabase é público, e um vazamento de admin viraria acesso ao e-CAC da empresa.
export interface Portal { nome: string; url: string; login: string }
export interface Documento { nome: string; url: string }
export interface Endereco {
  logradouro?: string; numero?: string; complemento?: string;
  bairro?: string; cidade?: string; uf?: string; cep?: string;
}
export interface Contador {
  nome?: string; escritorio?: string; telefone?: string; email?: string; dia_fechamento?: number;
}
export interface Certificado { tipo?: 'A1' | 'A3'; emissor?: string; validade?: string }

export interface EmpresaDados {
  id: string;
  razao_social: string | null; nome_fantasia: string | null; cnpj: string | null;
  inscricao_estadual: string | null; inscricao_municipal: string | null;
  cnae_principal: string | null; cnaes_secundarios: string[];
  regime_tributario: string; data_abertura: string | null; capital_social_centavos: number | null;
  endereco: Endereco; contador: Contador; certificado: Certificado;
  portais: Portal[]; documentos: Documento[];
  cotacao_usd_centavos: number;
}

export type CustoInput = {
  nome: string; categoria: string; valor_reais: string;
  moeda: 'BRL' | 'USD'; ciclo: 'mensal' | 'anual';
  dia_cobranca: number | null; url: string;
};

const EMPRESA_COLS = 'id, razao_social, nome_fantasia, cnpj, inscricao_estadual, inscricao_municipal, cnae_principal, cnaes_secundarios, regime_tributario, data_abertura, capital_social_centavos, endereco, contador, certificado, portais, documentos, cotacao_usd_centavos';
const CUSTO_COLS = 'id, nome, categoria, valor_centavos, moeda, ciclo, dia_cobranca, url, ativo';

/** "1.234,56" | "20.50" | "20" → centavos inteiros. null se não for número. */
export function reaisParaCentavos(v: string): number | null {
  const limpo = v.trim().replace(/\./g, '').replace(',', '.');
  if (!limpo) return null;
  const n = Number(limpo);
  if (!Number.isFinite(n)) return null;
  // Math.round e não truncamento: 20.15 * 100 dá 2014.9999... em ponto flutuante.
  return Math.round(n * 100);
}

export function validarCusto(input: CustoInput): string | null {
  if (!input.nome.trim()) return 'Nome é obrigatório.';
  if (reaisParaCentavos(input.valor_reais) == null) return 'Valor inválido.';
  if (input.dia_cobranca != null
    && (!Number.isInteger(input.dia_cobranca) || input.dia_cobranca < 1 || input.dia_cobranca > 31)) {
    return 'Dia da cobrança deve ficar entre 1 e 31.';
  }
  return null;
}

/** Certificado vencido trava emissão de nota fiscal — avisar com 30 dias de folga. */
export function alertaCertificado(
  cert: Certificado, hojeISO: string,
): { dias: number; nivel: 'ok' | 'atencao' | 'vencido' } | null {
  if (!cert.validade) return null;
  const [va, vm, vd] = cert.validade.slice(0, 10).split('-').map(Number);
  const [ha, hm, hd] = hojeISO.slice(0, 10).split('-').map(Number);
  const dias = Math.round((Date.UTC(va, vm - 1, vd) - Date.UTC(ha, hm - 1, hd)) / 86_400_000);
  if (dias < 0) return { dias, nivel: 'vencido' };
  return { dias, nivel: dias <= 30 ? 'atencao' : 'ok' };
}

export async function carregarEmpresa(): Promise<EmpresaDados | null> {
  const supabase = createClient();
  // A migration semeia exatamente uma linha. maybeSingle: se a RLS barrar, volta null
  // em vez de estourar — a UI mostra "sem acesso" em vez de tela branca.
  const { data } = await supabase.from('empresa_dados').select(EMPRESA_COLS).limit(1).maybeSingle();
  return (data as EmpresaDados | null) ?? null;
}

export async function salvarEmpresa(id: string, dados: Partial<EmpresaDados>): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.from('empresa_dados')
    .update({ ...dados, atualizado_em: new Date().toISOString() }).eq('id', id);
  return { error: error?.message ?? null };
}

export async function listarCustos(): Promise<CustoFixo[]> {
  const supabase = createClient();
  const { data } = await supabase.from('empresa_custos_fixos').select(CUSTO_COLS).order('nome');
  return (data ?? []) as CustoFixo[];
}

export async function salvarCusto(input: CustoInput, id?: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const payload = {
    nome: input.nome.trim(),
    categoria: input.categoria || null,
    valor_centavos: reaisParaCentavos(input.valor_reais)!,  // validarCusto() roda antes
    moeda: input.moeda,
    ciclo: input.ciclo,
    dia_cobranca: input.dia_cobranca,
    url: input.url || null,
  };
  const { error } = id
    ? await supabase.from('empresa_custos_fixos').update(payload).eq('id', id)
    : await supabase.from('empresa_custos_fixos').insert(payload);
  return { error: error?.message ?? null };
}

export async function removerCusto(id: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.from('empresa_custos_fixos').update({ ativo: false }).eq('id', id);
  return { error: error?.message ?? null };
}
```

- [ ] **Step 4: Rodar os testes e ver passar**

Run: `npm test -- lib/empresa-data.test.ts`
Expected: PASS — 12 testes verdes.

- [ ] **Step 5: Commit**

```bash
git add lib/empresa-data.ts lib/empresa-data.test.ts
git commit -m "feat(empresa): camada de dados de identidade e custos fixos"
```

---

### Task 5: Camada de dados — obrigações + espelho na agenda

⚠️ **Pré-requisito: a sessão paralela da Agenda/Sofia precisa ter feito merge.** Esta task escreve em `agenda_compromissos`.

**Files:**
- Modify: `lib/empresa-data.ts` (acrescenta as funções de obrigação ao final)

**Interfaces:**
- Consumes: `ModeloObrigacao`, `Ocorrencia`, `NovaOcorrencia`, `planoDeMaterializacao`, `competenciaDe` (Task 2).
- Produces:
  - `type ObrigacaoInput = { nome: string; categoria: ModeloObrigacao['categoria']; orgao: string; periodicidade: Periodicidade; dia_vencimento: number | null; mes_vencimento: number | null; vencimento_unico: string; valor_padrao_reais: string; link_portal: string; observacoes: string }`
  - `validarObrigacao(input: ObrigacaoInput): string | null`
  - `listarModelos(): Promise<ModeloObrigacao[]>`
  - `salvarObrigacao(input: ObrigacaoInput, id?: string): Promise<{ error: string | null }>`
  - `removerObrigacao(id: string): Promise<{ error: string | null }>`
  - `garantirOcorrencias(competencia: string): Promise<{ error: string | null }>`
  - `listarOcorrencias(competencia: string): Promise<Ocorrencia[]>`
  - `marcarPaga(id: string, valorReais: string, pagoEmISO: string): Promise<{ error: string | null }>`
  - `meuUsuarioId(): Promise<string | null>`

- [ ] **Step 1: Escrever os testes de `validarObrigacao`**

Append to `lib/empresa-data.test.ts`:

```ts
import { validarObrigacao, type ObrigacaoInput } from './empresa-data';

const obrig = (o: Partial<ObrigacaoInput>): ObrigacaoInput => ({
  nome: 'DAS', categoria: 'fiscal', orgao: 'Receita Federal', periodicidade: 'mensal',
  dia_vencimento: 20, mes_vencimento: null, vencimento_unico: '',
  valor_padrao_reais: '', link_portal: '', observacoes: '', ...o,
});

describe('validarObrigacao', () => {
  it('mensal com dia válido passa; valor vazio = variável (DAS)', () => {
    expect(validarObrigacao(obrig({}))).toBeNull();
  });

  it('nome vazio é rejeitado', () => {
    expect(validarObrigacao(obrig({ nome: ' ' }))).toBe('Nome é obrigatório.');
  });

  it('mensal sem dia de vencimento é rejeitado', () => {
    expect(validarObrigacao(obrig({ dia_vencimento: null }))).toBe('Escolha o dia do vencimento (1 a 31).');
  });

  // O input type=number aceita 15.5; a coluna é integer e o Postgres devolveria erro cru.
  it('dia fracionário é rejeitado', () => {
    expect(validarObrigacao(obrig({ dia_vencimento: 15.5 }))).toBe('Escolha o dia do vencimento (1 a 31).');
  });

  it('anual sem mês âncora é rejeitado', () => {
    expect(validarObrigacao(obrig({ periodicidade: 'anual', mes_vencimento: null })))
      .toBe('Obrigação anual precisa do mês de vencimento.');
  });

  it('única sem data é rejeitada', () => {
    expect(validarObrigacao(obrig({ periodicidade: 'unica', vencimento_unico: '' })))
      .toBe('Obrigação única precisa da data de vencimento.');
  });

  it('valor preenchido inválido é rejeitado', () => {
    expect(validarObrigacao(obrig({ valor_padrao_reais: 'abc' }))).toBe('Valor inválido.');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- lib/empresa-data.test.ts`
Expected: FAIL — `validarObrigacao is not a function` (ou erro de import).

- [ ] **Step 3: Implementar as funções de obrigação**

Primeiro, acrescentar este import **ao bloco de imports no topo** de `lib/empresa-data.ts` (não no meio do arquivo — o ESLint do Next reclama de `import` fora do topo):

```ts
import {
  competenciaDe, planoDeMaterializacao,
  type ModeloObrigacao, type Ocorrencia, type Periodicidade,
} from '@/lib/obrigacoes';
```

Depois, append ao final de `lib/empresa-data.ts`:

```ts
export type ObrigacaoInput = {
  nome: string; categoria: ModeloObrigacao['categoria']; orgao: string;
  periodicidade: Periodicidade;
  dia_vencimento: number | null; mes_vencimento: number | null; vencimento_unico: string;
  valor_padrao_reais: string; link_portal: string; observacoes: string;
};

const MODELO_COLS = 'id, nome, categoria, orgao, periodicidade, dia_vencimento, mes_vencimento, vencimento_unico, valor_padrao_centavos, link_portal, observacoes, ativo';
const OCORRENCIA_COLS = 'id, obrigacao_id, competencia, vencimento, valor_centavos, status, pago_em, comprovante_url';

/** Espelha os CHECKs do banco. Valor vazio = variável (caso do DAS) e é permitido. */
export function validarObrigacao(input: ObrigacaoInput): string | null {
  if (!input.nome.trim()) return 'Nome é obrigatório.';
  if (input.periodicidade === 'unica' && !input.vencimento_unico) {
    return 'Obrigação única precisa da data de vencimento.';
  }
  if (input.periodicidade !== 'unica'
    && (!Number.isInteger(input.dia_vencimento) || (input.dia_vencimento as number) < 1 || (input.dia_vencimento as number) > 31)) {
    return 'Escolha o dia do vencimento (1 a 31).';
  }
  if ((input.periodicidade === 'anual' || input.periodicidade === 'trimestral') && !input.mes_vencimento) {
    return input.periodicidade === 'anual'
      ? 'Obrigação anual precisa do mês de vencimento.'
      : 'Obrigação trimestral precisa do mês de referência.';
  }
  if (input.valor_padrao_reais.trim() && reaisParaCentavos(input.valor_padrao_reais) == null) {
    return 'Valor inválido.';
  }
  return null;
}

export async function listarModelos(): Promise<ModeloObrigacao[]> {
  const supabase = createClient();
  const { data } = await supabase.from('empresa_obrigacoes').select(MODELO_COLS).eq('ativo', true).order('nome');
  return (data ?? []) as ModeloObrigacao[];
}

export async function salvarObrigacao(input: ObrigacaoInput, id?: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const unica = input.periodicidade === 'unica';
  const payload = {
    nome: input.nome.trim(),
    categoria: input.categoria,
    orgao: input.orgao || null,
    periodicidade: input.periodicidade,
    dia_vencimento: unica ? null : input.dia_vencimento,
    mes_vencimento: (input.periodicidade === 'anual' || input.periodicidade === 'trimestral')
      ? input.mes_vencimento : null,
    vencimento_unico: unica ? input.vencimento_unico : null,
    valor_padrao_centavos: input.valor_padrao_reais.trim()
      ? reaisParaCentavos(input.valor_padrao_reais) : null,
    link_portal: input.link_portal || null,
    observacoes: input.observacoes || null,
  };
  const { error } = id
    ? await supabase.from('empresa_obrigacoes').update({ ...payload, atualizado_em: new Date().toISOString() }).eq('id', id)
    : await supabase.from('empresa_obrigacoes').insert(payload);
  return { error: error?.message ?? null };
}

export async function removerObrigacao(id: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.from('empresa_obrigacoes').update({ ativo: false }).eq('id', id);
  return { error: error?.message ?? null };
}

/** A linha em `usuarios` ligada ao auth de quem está logado (dono do compromisso espelhado). */
export async function meuUsuarioId(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('usuarios').select('id').eq('auth_user_id', user.id).maybeSingle();
  return data?.id ?? null;
}

/**
 * Garante que as ocorrências da competência existem, e espelha cada uma como
 * compromisso na agenda — é assim que o cron de lembretes QUE JÁ EXISTE passa a
 * avisar do DAS no WhatsApp, sem uma linha de código de lembrete aqui.
 *
 * Idempotente nas duas pontas: `ignoreDuplicates` no upsert bate no índice único
 * (obrigacao_id, competencia) das ocorrências, e em (origem, origem_id) na agenda.
 * Chamar dez vezes cria uma vez só.
 */
export async function garantirOcorrencias(competencia: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const modelos = await listarModelos();
  const plano = planoDeMaterializacao(modelos, competenciaDe(competencia));
  if (plano.length === 0) return { error: null };

  const { error } = await supabase
    .from('empresa_obrigacao_ocorrencias')
    .upsert(plano, { onConflict: 'obrigacao_id,competencia', ignoreDuplicates: true });
  if (error) return { error: error.message };

  const dono = await meuUsuarioId();
  if (!dono) return { error: null };  // sem linha em `usuarios`: a página funciona, só não espelha.

  const ocorrencias = await listarOcorrencias(competencia);
  const nomePorId = new Map(modelos.map((m) => [m.id, m.nome]));
  const espelhos = ocorrencias
    .filter((o) => o.status === 'pendente')
    .map((o) => ({
      usuario_id: dono,
      titulo: `Vence hoje: ${nomePorId.get(o.obrigacao_id) ?? 'obrigação da empresa'}`,
      descricao: 'Obrigação da empresa (criado pela página /empresa).',
      // 09:00 no fuso de SP — o mesmo formato que a agenda usa para compromisso único.
      inicio_em: new Date(`${o.vencimento}T09:00:00-03:00`).toISOString(),
      recorrencia: 'nenhuma' as const,
      antecedencia_min: 60,
      origem: 'empresa_obrigacao',
      origem_id: o.id,
    }));
  if (espelhos.length === 0) return { error: null };

  const { error: erroAgenda } = await supabase
    .from('agenda_compromissos')
    .upsert(espelhos, { onConflict: 'origem,origem_id', ignoreDuplicates: true });
  return { error: erroAgenda?.message ?? null };
}

export async function listarOcorrencias(competencia: string): Promise<Ocorrencia[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('empresa_obrigacao_ocorrencias').select(OCORRENCIA_COLS)
    .eq('competencia', competenciaDe(competencia))
    .order('vencimento');
  return (data ?? []) as Ocorrencia[];
}

/** Marca a ocorrência como paga e conclui o compromisso espelhado (o painel é o único escritor). */
export async function marcarPaga(id: string, valorReais: string, pagoEmISO: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const centavos = valorReais.trim() ? reaisParaCentavos(valorReais) : null;
  if (valorReais.trim() && centavos == null) return { error: 'Valor inválido.' };

  const patch: Record<string, unknown> = {
    status: 'paga', pago_em: pagoEmISO, atualizado_em: new Date().toISOString(),
  };
  if (centavos != null) patch.valor_centavos = centavos;

  const { error } = await supabase.from('empresa_obrigacao_ocorrencias').update(patch).eq('id', id);
  if (error) return { error: error.message };

  // Some da agenda: não faz sentido a Sofia cobrar no WhatsApp algo já pago.
  const { error: erroAgenda } = await supabase.from('agenda_compromissos')
    .update({ ativo: false }).eq('origem', 'empresa_obrigacao').eq('origem_id', id);
  return { error: erroAgenda?.message ?? null };
}
```

- [ ] **Step 4: Rodar os testes e ver passar**

Run: `npm test`
Expected: PASS — toda a suíte verde (agenda, ocorrência, obrigações, custos, empresa-data).

- [ ] **Step 5: Commit**

```bash
git add lib/empresa-data.ts lib/empresa-data.test.ts
git commit -m "feat(empresa): obrigacoes com materializacao idempotente + espelho na agenda"
```

---

### Task 6: Página `/empresa` — casca com abas + aba Identidade

**Files:**
- Create: `app/(admin)/empresa/page.tsx`
- Create: `components/empresa/AbaIdentidade.tsx`
- Modify: `app/(admin)/layout.tsx:8-15` (import do ícone + `navItems`)

**Interfaces:**
- Consumes: `carregarEmpresa`, `salvarEmpresa`, `alertaCertificado`, tipos `EmpresaDados`/`Portal`/`Documento` (Task 4).
- Produces: rota `/empresa`; componente `<AbaIdentidade empresa={...} onSalvo={...} />`.

- [ ] **Step 1: Acrescentar o item na sidebar**

Modify `app/(admin)/layout.tsx` — no import do lucide-react, acrescentar `Building2`; e em `navItems`, inserir a entrada de Empresa logo depois de Agenda:

```tsx
import { LayoutDashboard, Users, FileText, Settings, LogOut, Menu, ChevronsLeft, ChevronsRight, BarChart3, CalendarDays, Building2 } from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/agenda', label: 'Agenda', icon: CalendarDays },
  { href: '/empresa', label: 'Empresa', icon: Building2 },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/propostas', label: 'Propostas', icon: FileText },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/settings', label: 'Configuracoes', icon: Settings },
];
```

Não mexer no `proxy.ts`: `/empresa` fora de `AUTENTICADO_PREFIXES` **é** o que a torna admin-only.

- [ ] **Step 2: Escrever a casca da página com as três abas**

Create `app/(admin)/empresa/page.tsx`:

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Building2, ScrollText, Wallet } from 'lucide-react';
import { carregarEmpresa, type EmpresaDados } from '@/lib/empresa-data';
import AbaIdentidade from '@/components/empresa/AbaIdentidade';

type Aba = 'identidade' | 'obrigacoes' | 'custos';

const ABAS: { id: Aba; label: string; icon: typeof Building2 }[] = [
  { id: 'identidade', label: 'Identidade', icon: Building2 },
  { id: 'obrigacoes', label: 'Obrigações', icon: ScrollText },
  { id: 'custos', label: 'Custo fixo', icon: Wallet },
];

export default function EmpresaPage() {
  const [aba, setAba] = useState<Aba>('identidade');
  const [empresa, setEmpresa] = useState<EmpresaDados | null>(null);
  const [loading, setLoading] = useState(true);

  const recarregar = useCallback(async () => {
    setLoading(true);
    setEmpresa(await carregarEmpresa());
    setLoading(false);
  }, []);

  useEffect(() => { recarregar(); }, [recarregar]);

  if (loading) return <p style={{ opacity: 0.6 }}>Carregando…</p>;

  // A RLS é admin-only: se voltou null, ou o seed não rodou, ou quem chamou não é admin.
  if (!empresa) {
    return (
      <p style={{ opacity: 0.8 }}>
        Nenhum registro de empresa acessível. Confirme que a migration
        <code> 003_empresa_admin.sql </code> foi aplicada e que você está logado como admin.
      </p>
    );
  }

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-cinzel)', fontSize: '1.6rem', marginBottom: '1.5rem' }}>
        Empresa
      </h1>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {ABAS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`admin-nav-link${aba === id ? ' active' : ''}`}
            style={{ padding: '0.5rem 1rem' }}
          >
            <Icon size={16} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {aba === 'identidade' && <AbaIdentidade empresa={empresa} onSalvo={recarregar} />}
      {aba === 'obrigacoes' && <p style={{ opacity: 0.6 }}>Em construção (Task 7).</p>}
      {aba === 'custos' && <p style={{ opacity: 0.6 }}>Em construção (Task 8).</p>}
    </div>
  );
}
```

- [ ] **Step 3: Escrever a aba Identidade**

Create `components/empresa/AbaIdentidade.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Copy, Check, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import {
  salvarEmpresa, alertaCertificado,
  type EmpresaDados, type Portal, type Documento,
} from '@/lib/empresa-data';

function hojeISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function Campo({ label, valor, onChange, copiavel = false }: {
  label: string; valor: string; onChange: (v: string) => void; copiavel?: boolean;
}) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    await navigator.clipboard.writeText(valor);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  };
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{label}</span>
      <span style={{ display: 'flex', gap: '0.25rem' }}>
        <input value={valor} onChange={(e) => onChange(e.target.value)} style={{ flex: 1 }} />
        {copiavel && (
          <button type="button" onClick={copiar} title={`Copiar ${label}`} disabled={!valor}>
            {copiado ? <Check size={14} /> : <Copy size={14} />}
          </button>
        )}
      </span>
    </label>
  );
}

export default function AbaIdentidade({ empresa, onSalvo }: {
  empresa: EmpresaDados; onSalvo: () => void;
}) {
  const [e, setE] = useState<EmpresaDados>(empresa);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const set = <K extends keyof EmpresaDados>(k: K, v: EmpresaDados[K]) => setE((prev) => ({ ...prev, [k]: v }));
  const alerta = alertaCertificado(e.certificado, hojeISO());

  const salvar = async () => {
    setSalvando(true); setErro('');
    const { id, ...dados } = e;
    const { error } = await salvarEmpresa(id, dados);
    setSalvando(false);
    if (error) setErro(error); else onSalvo();
  };

  return (
    <div style={{ display: 'grid', gap: '1.5rem', maxWidth: 960 }}>
      {alerta && alerta.nivel !== 'ok' && (
        <div className="admin-card" style={{ borderColor: alerta.nivel === 'vencido' ? '#e85d75' : '#d4a04a' }}>
          <AlertTriangle size={16} style={{ color: alerta.nivel === 'vencido' ? '#e85d75' : '#d4a04a' }} />
          {alerta.nivel === 'vencido'
            ? ` Certificado digital VENCIDO há ${Math.abs(alerta.dias)} dia(s) — emissão de nota fiscal travada.`
            : ` Certificado digital vence em ${alerta.dias} dia(s). Renove antes de travar a emissão de nota.`}
        </div>
      )}

      <section className="admin-card">
        <h2>Cadastro</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          <Campo label="Razão social" valor={e.razao_social ?? ''} onChange={(v) => set('razao_social', v)} copiavel />
          <Campo label="Nome fantasia" valor={e.nome_fantasia ?? ''} onChange={(v) => set('nome_fantasia', v)} />
          <Campo label="CNPJ" valor={e.cnpj ?? ''} onChange={(v) => set('cnpj', v)} copiavel />
          <Campo label="Inscrição estadual" valor={e.inscricao_estadual ?? ''} onChange={(v) => set('inscricao_estadual', v)} copiavel />
          <Campo label="Inscrição municipal" valor={e.inscricao_municipal ?? ''} onChange={(v) => set('inscricao_municipal', v)} copiavel />
          <Campo label="CNAE principal" valor={e.cnae_principal ?? ''} onChange={(v) => set('cnae_principal', v)} copiavel />
          <Campo label="Data de abertura" valor={e.data_abertura ?? ''} onChange={(v) => set('data_abertura', v)} />
          <Campo label="Regime tributário" valor={e.regime_tributario} onChange={(v) => set('regime_tributario', v)} />
        </div>
      </section>

      <section className="admin-card">
        <h2>Endereço fiscal</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          {(['logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'cep'] as const).map((k) => (
            <Campo key={k} label={k[0].toUpperCase() + k.slice(1)} valor={e.endereco[k] ?? ''}
              onChange={(v) => set('endereco', { ...e.endereco, [k]: v })} />
          ))}
        </div>
      </section>

      <section className="admin-card">
        <h2>Contador</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          <Campo label="Nome" valor={e.contador.nome ?? ''} onChange={(v) => set('contador', { ...e.contador, nome: v })} />
          <Campo label="Escritório" valor={e.contador.escritorio ?? ''} onChange={(v) => set('contador', { ...e.contador, escritorio: v })} />
          <Campo label="Telefone" valor={e.contador.telefone ?? ''} onChange={(v) => set('contador', { ...e.contador, telefone: v })} copiavel />
          <Campo label="E-mail" valor={e.contador.email ?? ''} onChange={(v) => set('contador', { ...e.contador, email: v })} copiavel />
        </div>
      </section>

      <section className="admin-card">
        <h2>Certificado digital</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Tipo</span>
            <select value={e.certificado.tipo ?? 'A1'}
              onChange={(ev) => set('certificado', { ...e.certificado, tipo: ev.target.value as 'A1' | 'A3' })}>
              <option value="A1">A1</option>
              <option value="A3">A3</option>
            </select>
          </label>
          <Campo label="Emissor" valor={e.certificado.emissor ?? ''} onChange={(v) => set('certificado', { ...e.certificado, emissor: v })} />
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Validade</span>
            <input type="date" value={e.certificado.validade ?? ''}
              onChange={(ev) => set('certificado', { ...e.certificado, validade: ev.target.value })} />
          </label>
        </div>
      </section>

      <section className="admin-card">
        <h2>Portais</h2>
        <p style={{ fontSize: '0.75rem', opacity: 0.6 }}>
          Sem senha, de propósito. Guardamos só o link e o login — a senha fica no seu gerenciador.
        </p>
        {e.portais.map((p, i) => (
          <div key={i} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <input placeholder="Nome" value={p.nome}
              onChange={(ev) => set('portais', e.portais.map((x, j) => j === i ? { ...x, nome: ev.target.value } : x))} />
            <input placeholder="URL" value={p.url}
              onChange={(ev) => set('portais', e.portais.map((x, j) => j === i ? { ...x, url: ev.target.value } : x))} />
            <input placeholder="Login" value={p.login}
              onChange={(ev) => set('portais', e.portais.map((x, j) => j === i ? { ...x, login: ev.target.value } : x))} />
            <button type="button" onClick={() => set('portais', e.portais.filter((_, j) => j !== i))} aria-label="Remover portal">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button type="button" style={{ marginTop: '0.75rem' }}
          onClick={() => set('portais', [...e.portais, { nome: '', url: '', login: '' } as Portal])}>
          <Plus size={14} /> Adicionar portal
        </button>
      </section>

      <section className="admin-card">
        <h2>Documentos</h2>
        <p style={{ fontSize: '0.75rem', opacity: 0.6 }}>Link externo (Drive/OneDrive) — nada é enviado para o banco.</p>
        {e.documentos.map((d, i) => (
          <div key={i} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <input placeholder="Nome" value={d.nome}
              onChange={(ev) => set('documentos', e.documentos.map((x, j) => j === i ? { ...x, nome: ev.target.value } : x))} />
            <input placeholder="URL" value={d.url}
              onChange={(ev) => set('documentos', e.documentos.map((x, j) => j === i ? { ...x, url: ev.target.value } : x))} />
            <button type="button" onClick={() => set('documentos', e.documentos.filter((_, j) => j !== i))} aria-label="Remover documento">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button type="button" style={{ marginTop: '0.75rem' }}
          onClick={() => set('documentos', [...e.documentos, { nome: '', url: '' } as Documento])}>
          <Plus size={14} /> Adicionar documento
        </button>
      </section>

      {erro && <p style={{ color: '#e85d75' }}>{erro}</p>}
      <button onClick={salvar} disabled={salvando} className="admin-nav-link active" style={{ justifySelf: 'start', padding: '0.6rem 1.5rem' }}>
        {salvando ? 'Salvando…' : 'Salvar'}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Verificar tipos e build**

Run: `npx tsc --noEmit`
Expected: sem erros.

Run: `npm run dev -- -p 3333`, abrir `http://localhost:3333/empresa` logado como admin.
Expected: aba Identidade renderiza; preencher CNPJ, salvar, recarregar a página e o valor persiste; o botão de copiar coloca o CNPJ na área de transferência.

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/empresa/page.tsx" components/empresa/AbaIdentidade.tsx "app/(admin)/layout.tsx"
git commit -m "feat(empresa): rota /empresa com abas + aba de identidade da PJ"
```

---

### Task 7: Aba Obrigações

**Files:**
- Create: `components/empresa/AbaObrigacoes.tsx`
- Modify: `app/(admin)/empresa/page.tsx` (trocar o placeholder da aba)

**Interfaces:**
- Consumes: `listarModelos`, `salvarObrigacao`, `removerObrigacao`, `garantirOcorrencias`, `listarOcorrencias`, `marcarPaga`, `validarObrigacao`, `ObrigacaoInput` (Task 5); `statusExibido`, `venceEmDias`, `competenciaDe` (Task 2); `formatBRL` (`lib/format.ts`).
- Produces: `<AbaObrigacoes />`.

- [ ] **Step 1: Escrever o componente**

Create `components/empresa/AbaObrigacoes.tsx`:

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Check, Trash2, ExternalLink } from 'lucide-react';
import {
  listarModelos, salvarObrigacao, removerObrigacao, validarObrigacao,
  garantirOcorrencias, listarOcorrencias, marcarPaga, type ObrigacaoInput,
} from '@/lib/empresa-data';
import { statusExibido, venceEmDias, competenciaDe, type ModeloObrigacao, type Ocorrencia } from '@/lib/obrigacoes';
import { formatBRL } from '@/lib/format';

function hojeISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

const CORES: Record<string, string> = {
  paga: '#4ad48a', pendente: '#d4a04a', atrasada: '#e85d75', dispensada: '#7a7a8c',
};

// Modelos típicos de ME/EPP no Simples. São SUGESTÕES: um clique preenche o formulário,
// e o Valmir edita ou apaga. Nada é criado sem ele mandar.
const SUGESTOES: Partial<ObrigacaoInput>[] = [
  { nome: 'DAS — Simples Nacional', categoria: 'fiscal', orgao: 'Receita Federal', periodicidade: 'mensal', dia_vencimento: 20 },
  { nome: 'Honorários do contador', categoria: 'contabil', periodicidade: 'mensal', dia_vencimento: 5 },
  { nome: 'Pró-labore + INSS', categoria: 'trabalhista', periodicidade: 'mensal', dia_vencimento: 20 },
  { nome: 'DEFIS', categoria: 'fiscal', orgao: 'Receita Federal', periodicidade: 'anual', mes_vencimento: 3, dia_vencimento: 31 },
  { nome: 'Renovação do certificado digital', categoria: 'societaria', periodicidade: 'anual', mes_vencimento: 1, dia_vencimento: 1 },
];

function vazio(): ObrigacaoInput {
  return {
    nome: '', categoria: 'fiscal', orgao: '', periodicidade: 'mensal',
    dia_vencimento: 20, mes_vencimento: null, vencimento_unico: '',
    valor_padrao_reais: '', link_portal: '', observacoes: '',
  };
}

export default function AbaObrigacoes() {
  const [competencia, setCompetencia] = useState(() => competenciaDe(hojeISO()).slice(0, 7)); // YYYY-MM
  const [modelos, setModelos] = useState<ModeloObrigacao[]>([]);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<ObrigacaoInput | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  const recarregar = useCallback(async (comp: string) => {
    setLoading(true); setErro('');
    const primeiroDia = `${comp}-01`;
    // Materializa antes de listar — idempotente pelo índice único no banco.
    const { error } = await garantirOcorrencias(primeiroDia);
    if (error) setErro(error);
    setModelos(await listarModelos());
    setOcorrencias(await listarOcorrencias(primeiroDia));
    setLoading(false);
  }, []);

  useEffect(() => { recarregar(competencia); }, [competencia, recarregar]);

  const hoje = hojeISO();
  const nome = (id: string) => modelos.find((m) => m.id === id)?.nome ?? '—';
  const linkDe = (id: string) => modelos.find((m) => m.id === id)?.link_portal ?? null;

  const comStatus = ocorrencias.map((o) => ({ o, status: statusExibido(o, hoje), dias: venceEmDias(o, hoje) }));
  const vencendo = comStatus.filter((x) => x.status === 'pendente' && x.dias <= 7).length;
  const atrasadas = comStatus.filter((x) => x.status === 'atrasada').length;
  const pagas = comStatus.filter((x) => x.status === 'paga').length;

  const pagar = async (o: Ocorrencia) => {
    const sugestao = o.valor_centavos != null ? (o.valor_centavos / 100).toFixed(2).replace('.', ',') : '';
    const valor = window.prompt(`Valor pago em ${nome(o.obrigacao_id)} (R$):`, sugestao);
    if (valor === null) return;  // cancelou
    const { error } = await marcarPaga(o.id, valor, hoje);
    if (error) setErro(error); else recarregar(competencia);
  };

  const submeter = async () => {
    if (!form) return;
    const msg = validarObrigacao(form);
    if (msg) { setErro(msg); return; }
    const { error } = await salvarObrigacao(form, editId ?? undefined);
    if (error) { setErro(error); return; }
    setForm(null); setEditId(null);
    recarregar(competencia);
  };

  const excluir = async (id: string) => {
    if (!window.confirm('Desativar esta obrigação? As ocorrências passadas continuam no histórico.')) return;
    const { error } = await removerObrigacao(id);
    if (error) setErro(error); else recarregar(competencia);
  };

  return (
    <div style={{ display: 'grid', gap: '1.5rem', maxWidth: 960 }}>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
        <span style={{ color: CORES.pendente }}>{vencendo} vencendo em 7 dias</span>
        <span style={{ color: CORES.atrasada }}>{atrasadas} atrasada(s)</span>
        <span style={{ color: CORES.paga }}>{pagas} paga(s)</span>
        <button type="button" style={{ marginLeft: 'auto' }} onClick={() => { setForm(vazio()); setEditId(null); setErro(''); }}>
          <Plus size={14} /> Nova obrigação
        </button>
      </div>

      {erro && <p style={{ color: '#e85d75' }}>{erro}</p>}
      {loading && <p style={{ opacity: 0.6 }}>Carregando…</p>}

      {!loading && ocorrencias.length === 0 && (
        <div className="admin-card">
          <p>Nenhuma obrigação vence neste mês.</p>
          <p style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.5rem' }}>Sugestões para ME/EPP no Simples:</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            {SUGESTOES.map((s) => (
              <button key={s.nome} type="button"
                onClick={() => { setForm({ ...vazio(), ...s }); setEditId(null); setErro(''); }}>
                <Plus size={12} /> {s.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      {!loading && comStatus.map(({ o, status, dias }) => (
        <div key={o.id} className="admin-card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 180 }}>{nome(o.obrigacao_id)}</span>
          <span style={{ opacity: 0.8 }}>
            vence {o.vencimento.slice(8, 10)}/{o.vencimento.slice(5, 7)}
            {status === 'pendente' && dias >= 0 && ` (em ${dias}d)`}
            {status === 'atrasada' && ` (há ${Math.abs(dias)}d)`}
          </span>
          <span>{o.valor_centavos != null ? formatBRL(o.valor_centavos) : '—'}</span>
          <span style={{ color: CORES[status], fontWeight: 600 }}>{status}</span>
          {linkDe(o.obrigacao_id) && (
            <a href={linkDe(o.obrigacao_id)!} target="_blank" rel="noreferrer" aria-label="Abrir portal">
              <ExternalLink size={14} />
            </a>
          )}
          {status !== 'paga' && status !== 'dispensada' && (
            <button type="button" onClick={() => pagar(o)}><Check size={14} /> Marcar paga</button>
          )}
        </div>
      ))}

      <section className="admin-card">
        <h2>Obrigações cadastradas</h2>
        {modelos.map((m) => (
          <div key={m.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.5rem' }}>
            <span style={{ flex: 1 }}>{m.nome}</span>
            <span style={{ opacity: 0.6, fontSize: '0.8rem' }}>{m.periodicidade}</span>
            <span style={{ opacity: 0.6, fontSize: '0.8rem' }}>
              {m.valor_padrao_centavos != null ? formatBRL(m.valor_padrao_centavos) : 'valor variável'}
            </span>
            <button type="button" onClick={() => {
              setEditId(m.id); setErro('');
              setForm({
                nome: m.nome, categoria: m.categoria, orgao: m.orgao ?? '', periodicidade: m.periodicidade,
                dia_vencimento: m.dia_vencimento, mes_vencimento: m.mes_vencimento,
                vencimento_unico: m.vencimento_unico ?? '',
                valor_padrao_reais: m.valor_padrao_centavos != null
                  ? (m.valor_padrao_centavos / 100).toFixed(2).replace('.', ',') : '',
                link_portal: m.link_portal ?? '', observacoes: m.observacoes ?? '',
              });
            }}>Editar</button>
            <button type="button" onClick={() => excluir(m.id)} aria-label="Desativar"><Trash2 size={14} /></button>
          </div>
        ))}
        {modelos.length === 0 && <p style={{ opacity: 0.6 }}>Nenhuma obrigação cadastrada ainda.</p>}
      </section>

      {form && (
        <section className="admin-card" style={{ display: 'grid', gap: '0.75rem' }}>
          <h2>{editId ? 'Editar obrigação' : 'Nova obrigação'}</h2>
          <input placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <input placeholder="Órgão" value={form.orgao} onChange={(e) => setForm({ ...form, orgao: e.target.value })} />
          <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
            <option value="fiscal">Fiscal</option>
            <option value="contabil">Contábil</option>
            <option value="trabalhista">Trabalhista</option>
            <option value="societaria">Societária</option>
          </select>
          <select value={form.periodicidade}
            onChange={(e) => setForm({ ...form, periodicidade: e.target.value as ObrigacaoInput['periodicidade'] })}>
            <option value="mensal">Mensal</option>
            <option value="trimestral">Trimestral</option>
            <option value="anual">Anual</option>
            <option value="unica">Única</option>
          </select>

          {form.periodicidade === 'unica' ? (
            <input type="date" value={form.vencimento_unico}
              onChange={(e) => setForm({ ...form, vencimento_unico: e.target.value })} />
          ) : (
            <input type="number" min={1} max={31} placeholder="Dia do vencimento"
              value={form.dia_vencimento ?? ''}
              onChange={(e) => setForm({ ...form, dia_vencimento: e.target.value ? Number(e.target.value) : null })} />
          )}

          {(form.periodicidade === 'anual' || form.periodicidade === 'trimestral') && (
            <input type="number" min={1} max={12}
              placeholder={form.periodicidade === 'anual' ? 'Mês do vencimento (1-12)' : 'Mês de referência (1-12)'}
              value={form.mes_vencimento ?? ''}
              onChange={(e) => setForm({ ...form, mes_vencimento: e.target.value ? Number(e.target.value) : null })} />
          )}

          <input placeholder="Valor padrão em R$ (vazio = variável, ex.: DAS)"
            value={form.valor_padrao_reais}
            onChange={(e) => setForm({ ...form, valor_padrao_reais: e.target.value })} />
          <input placeholder="Link do portal" value={form.link_portal}
            onChange={(e) => setForm({ ...form, link_portal: e.target.value })} />

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={submeter}>Salvar</button>
            <button type="button" onClick={() => { setForm(null); setEditId(null); setErro(''); }}>Cancelar</button>
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Ligar a aba na página**

Modify `app/(admin)/empresa/page.tsx` — acrescentar o import e trocar o placeholder:

```tsx
import AbaObrigacoes from '@/components/empresa/AbaObrigacoes';
```

```tsx
      {aba === 'obrigacoes' && <AbaObrigacoes />}
```

- [ ] **Step 3: Verificar tipos e exercitar o fluxo**

Run: `npx tsc --noEmit`
Expected: sem erros.

Run: `npm run dev -- -p 3333`, abrir `/empresa` → aba Obrigações. Cadastrar "Honorários do contador" (mensal, dia 5, R$ 900,00).
Expected: a ocorrência do mês corrente aparece com status `pendente` e valor R$ 900,00.

Recarregar a página **três vezes**.
Expected: continua **uma** ocorrência — a materialização é idempotente.

Abrir `/agenda`.
Expected: existe o compromisso "Vence hoje: Honorários do contador" no dia 5, dono = Valmir.

Voltar em `/empresa`, clicar em *Marcar paga*, informar `900,00`.
Expected: status vira `paga`; o compromisso some da `/agenda`.

- [ ] **Step 4: Commit**

```bash
git add components/empresa/AbaObrigacoes.tsx "app/(admin)/empresa/page.tsx"
git commit -m "feat(empresa): aba de obrigacoes com materializacao, status derivado e baixa de pagamento"
```

---

### Task 8: Aba Custo fixo + verificação final

**Files:**
- Create: `components/empresa/AbaCustos.tsx`
- Modify: `app/(admin)/empresa/page.tsx` (trocar o placeholder)

**Interfaces:**
- Consumes: `listarCustos`, `salvarCusto`, `removerCusto`, `validarCusto`, `salvarEmpresa`, `CustoInput`, `EmpresaDados` (Task 4); `custoFixoTotalMensal`, `custoMensalEmBRL`, `custoObrigacoesMensal`, `CustoFixo` (Task 3); `listarModelos` (Task 5); `formatBRL`.
- Produces: `<AbaCustos empresa={...} onSalvo={...} />`.

- [ ] **Step 1: Escrever o componente**

Create `components/empresa/AbaCustos.tsx`:

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  listarCustos, salvarCusto, removerCusto, validarCusto, salvarEmpresa, listarModelos,
  type CustoInput, type EmpresaDados,
} from '@/lib/empresa-data';
import { custoFixoTotalMensal, custoMensalEmBRL, custoObrigacoesMensal, type CustoFixo } from '@/lib/custos';
import type { ModeloObrigacao } from '@/lib/obrigacoes';
import { formatBRL } from '@/lib/format';

function vazio(): CustoInput {
  return { nome: '', categoria: '', valor_reais: '', moeda: 'BRL', ciclo: 'mensal', dia_cobranca: null, url: '' };
}

export default function AbaCustos({ empresa, onSalvo }: { empresa: EmpresaDados; onSalvo: () => void }) {
  const [custos, setCustos] = useState<CustoFixo[]>([]);
  const [modelos, setModelos] = useState<ModeloObrigacao[]>([]);
  const [form, setForm] = useState<CustoInput | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [cotacao, setCotacao] = useState((empresa.cotacao_usd_centavos / 100).toFixed(2).replace('.', ','));
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(true);

  const recarregar = useCallback(async () => {
    setLoading(true);
    setCustos(await listarCustos());
    setModelos(await listarModelos());
    setLoading(false);
  }, []);

  useEffect(() => { recarregar(); }, [recarregar]);

  const cot = empresa.cotacao_usd_centavos;
  const totalAssinaturas = custoFixoTotalMensal(custos, cot);
  const totalObrigacoes = custoObrigacoesMensal(modelos);
  const total = totalAssinaturas + totalObrigacoes;

  const salvarCotacao = async () => {
    const centavos = Math.round(Number(cotacao.replace(',', '.')) * 100);
    if (!Number.isFinite(centavos) || centavos <= 0) { setErro('Cotação inválida.'); return; }
    const { error } = await salvarEmpresa(empresa.id, { cotacao_usd_centavos: centavos });
    if (error) setErro(error); else onSalvo();
  };

  const submeter = async () => {
    if (!form) return;
    const msg = validarCusto(form);
    if (msg) { setErro(msg); return; }
    const { error } = await salvarCusto(form, editId ?? undefined);
    if (error) { setErro(error); return; }
    setForm(null); setEditId(null); setErro('');
    recarregar();
  };

  const excluir = async (id: string) => {
    const { error } = await removerCusto(id);
    if (error) setErro(error); else recarregar();
  };

  return (
    <div style={{ display: 'grid', gap: '1.5rem', maxWidth: 960 }}>
      <section className="admin-card">
        <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Custo de manter a empresa viva</p>
        <p style={{ fontFamily: 'var(--font-cinzel)', fontSize: '2.2rem' }}>{formatBRL(total)}<span style={{ fontSize: '1rem', opacity: 0.6 }}> / mês</span></p>
        <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>
          {formatBRL(totalObrigacoes)} em obrigações fixas + {formatBRL(totalAssinaturas)} em assinaturas.
          Obrigações de valor variável (ex.: DAS) ficam de fora — chutar um número aqui seria pior que omitir.
        </p>
      </section>

      <section className="admin-card" style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Cotação do dólar (R$)</span>
          <input value={cotacao} onChange={(e) => setCotacao(e.target.value)} style={{ width: 120 }} />
        </label>
        <button type="button" onClick={salvarCotacao}>Atualizar cotação</button>
        <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>Você mantém à mão — sem API externa.</span>
      </section>

      {erro && <p style={{ color: '#e85d75' }}>{erro}</p>}
      {loading && <p style={{ opacity: 0.6 }}>Carregando…</p>}

      <section className="admin-card">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h2 style={{ flex: 1 }}>Assinaturas e ferramentas</h2>
          <button type="button" onClick={() => { setForm(vazio()); setEditId(null); setErro(''); }}>
            <Plus size={14} /> Novo custo
          </button>
        </div>
        {custos.filter((c) => c.ativo).map((c) => (
          <div key={c.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.5rem' }}>
            <span style={{ flex: 1 }}>{c.nome}</span>
            <span style={{ opacity: 0.6, fontSize: '0.8rem' }}>{c.moeda} · {c.ciclo}</span>
            <span>{formatBRL(custoMensalEmBRL(c, cot))}<span style={{ opacity: 0.5, fontSize: '0.8rem' }}>/mês</span></span>
            <button type="button" onClick={() => {
              setEditId(c.id); setErro('');
              setForm({
                nome: c.nome, categoria: c.categoria ?? '',
                valor_reais: (c.valor_centavos / 100).toFixed(2).replace('.', ','),
                moeda: c.moeda, ciclo: c.ciclo, dia_cobranca: c.dia_cobranca, url: c.url ?? '',
              });
            }}>Editar</button>
            <button type="button" onClick={() => excluir(c.id)} aria-label="Remover"><Trash2 size={14} /></button>
          </div>
        ))}
        {!loading && custos.filter((c) => c.ativo).length === 0 && (
          <p style={{ opacity: 0.6 }}>Nenhuma assinatura cadastrada (Vercel, Railway, Supabase, domínio…).</p>
        )}
      </section>

      {form && (
        <section className="admin-card" style={{ display: 'grid', gap: '0.75rem' }}>
          <h2>{editId ? 'Editar custo' : 'Novo custo'}</h2>
          <input placeholder="Nome (ex.: Vercel)" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <input placeholder="Categoria (ex.: infra)" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
          <input placeholder="Valor (ex.: 20,00)" value={form.valor_reais} onChange={(e) => setForm({ ...form, valor_reais: e.target.value })} />
          <select value={form.moeda} onChange={(e) => setForm({ ...form, moeda: e.target.value as 'BRL' | 'USD' })}>
            <option value="BRL">BRL</option>
            <option value="USD">USD</option>
          </select>
          <select value={form.ciclo} onChange={(e) => setForm({ ...form, ciclo: e.target.value as 'mensal' | 'anual' })}>
            <option value="mensal">Mensal</option>
            <option value="anual">Anual</option>
          </select>
          <input type="number" min={1} max={31} placeholder="Dia da cobrança (opcional)"
            value={form.dia_cobranca ?? ''}
            onChange={(e) => setForm({ ...form, dia_cobranca: e.target.value ? Number(e.target.value) : null })} />
          <input placeholder="URL (opcional)" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={submeter}>Salvar</button>
            <button type="button" onClick={() => { setForm(null); setEditId(null); setErro(''); }}>Cancelar</button>
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Ligar a aba na página**

Modify `app/(admin)/empresa/page.tsx` — acrescentar o import e trocar o placeholder:

```tsx
import AbaCustos from '@/components/empresa/AbaCustos';
```

```tsx
      {aba === 'custos' && <AbaCustos empresa={empresa} onSalvo={recarregar} />}
```

- [ ] **Step 3: Suíte completa, tipos e build**

Run: `npm test`
Expected: PASS — toda a suíte verde.

Run: `npx tsc --noEmit`
Expected: sem erros.

Run: `npm run build`
Expected: build verde. (Se der `EPERM unlink` no `.next`, é o OneDrive travando o cache: apagar `.next` e rodar de novo.)

- [ ] **Step 4: Verificação end-to-end no app real**

Run: `npm run dev -- -p 3333` e, logado como admin, percorrer:

1. Aba Custo fixo: cadastrar "Vercel" — 20,00 USD, mensal. Com a cotação em R$ 5,00, a linha mostra **R$ 100,00/mês**.
2. Cadastrar "Domínio" — 60,00 BRL, **anual**. A linha mostra **R$ 5,00/mês** (diluído em 12).
3. O total no topo é `obrigações fixas + assinaturas` — confere com a soma das linhas.
4. Trocar a cotação para 6,00 e clicar em *Atualizar cotação*: a linha da Vercel vira **R$ 120,00/mês**.

- [ ] **Step 5: Rodar a verificação de RLS de novo (o banco mudou de forma desde a Task 1)**

Run:
```bash
node scripts/verify-empresa-rls.mjs veronezrepresentacoes@gmail.com <senha-admin> henriquefilho185@gmail.com <senha-henrique>
```
Expected: `OK: tabelas empresa_* sao admin-only (leitura e escrita verificadas por rejeicao ativa).`

Um `npm run build` verde **não prova nada** sobre isolamento — este script prova.

- [ ] **Step 6: Commit**

```bash
git add components/empresa/AbaCustos.tsx "app/(admin)/empresa/page.tsx"
git commit -m "feat(empresa): aba de custo fixo mensal com conversao de moeda"
```

---

### Task 9: Série dos últimos 12 meses (o custo está subindo?)

Fecha o último requisito da spec (§3, aba Custo fixo): a linha do tempo do que foi **efetivamente pago**.

**Files:**
- Modify: `lib/custos.ts` (acrescenta `serieMensalPaga`)
- Modify: `lib/custos.test.ts` (acrescenta os testes)
- Modify: `lib/empresa-data.ts` (acrescenta `listarPagasDesde`)
- Modify: `components/empresa/AbaCustos.tsx` (renderiza a série)

**Interfaces:**
- Consumes: `Ocorrencia` (Task 2), `listarOcorrencias` (Task 5).
- Produces:
  - `mesesAnteriores(hojeISO: string, quantos: number): string[]` — competências (`YYYY-MM-01`) do mais antigo ao mais recente, incluindo o mês corrente.
  - `serieMensalPaga(ocorrencias: Ocorrencia[], meses: string[]): { competencia: string; total_centavos: number }[]`
  - `listarPagasDesde(competenciaInicial: string): Promise<Ocorrencia[]>`

- [ ] **Step 1: Escrever os testes que falham**

Append to `lib/custos.test.ts`:

```ts
import { mesesAnteriores, serieMensalPaga } from './custos';
import type { Ocorrencia } from './obrigacoes';

const oc = (o: Partial<Ocorrencia>): Ocorrencia => ({
  id: 'oc1', obrigacao_id: 'o1', competencia: '2026-07-01', vencimento: '2026-07-20',
  valor_centavos: 90000, status: 'paga', pago_em: '2026-07-05', comprovante_url: null, ...o,
});

describe('mesesAnteriores', () => {
  it('devolve as N competências até o mês corrente, do mais antigo ao mais novo', () => {
    expect(mesesAnteriores('2026-07-12', 3)).toEqual(['2026-05-01', '2026-06-01', '2026-07-01']);
  });

  // A virada de ano é onde a aritmética ingênua de mês quebra.
  it('atravessa a virada de ano', () => {
    expect(mesesAnteriores('2026-02-10', 4)).toEqual(['2025-11-01', '2025-12-01', '2026-01-01', '2026-02-01']);
  });
});

describe('serieMensalPaga', () => {
  it('soma só as PAGAS, por competência', () => {
    const serie = serieMensalPaga([
      oc({ id: 'a', competencia: '2026-06-01', valor_centavos: 90000 }),
      oc({ id: 'b', competencia: '2026-06-01', valor_centavos: 45000 }),
      oc({ id: 'c', competencia: '2026-07-01', valor_centavos: 90000 }),
      oc({ id: 'd', competencia: '2026-07-01', status: 'pendente', valor_centavos: 30000 }),  // não entra
      oc({ id: 'e', competencia: '2026-07-01', status: 'paga', valor_centavos: null }),        // sem valor: não entra
    ], ['2026-06-01', '2026-07-01']);

    expect(serie).toEqual([
      { competencia: '2026-06-01', total_centavos: 135000 },
      { competencia: '2026-07-01', total_centavos: 90000 },
    ]);
  });

  it('mês sem pagamento aparece com zero (o buraco na série é informação)', () => {
    expect(serieMensalPaga([], ['2026-06-01', '2026-07-01'])).toEqual([
      { competencia: '2026-06-01', total_centavos: 0 },
      { competencia: '2026-07-01', total_centavos: 0 },
    ]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- lib/custos.test.ts`
Expected: FAIL — `mesesAnteriores is not a function`.

- [ ] **Step 3: Implementar**

Append to `lib/custos.ts`:

```ts
import type { Ocorrencia } from './obrigacoes';

/** As `quantos` últimas competências (YYYY-MM-01), do mais antigo ao mês corrente. */
export function mesesAnteriores(hojeISO: string, quantos: number): string[] {
  const [ano, mes] = hojeISO.slice(0, 10).split('-').map(Number);
  const meses: string[] = [];
  for (let i = quantos - 1; i >= 0; i--) {
    // Date.UTC normaliza mês negativo sozinho (mês 0 de 2026 = dezembro de 2025).
    const d = new Date(Date.UTC(ano, mes - 1 - i, 1));
    meses.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`);
  }
  return meses;
}

/** Total efetivamente PAGO por competência. Ocorrência paga sem valor informado não entra —
 *  somar zero seria mentir tanto quanto chutar. */
export function serieMensalPaga(
  ocorrencias: Ocorrencia[], meses: string[],
): { competencia: string; total_centavos: number }[] {
  return meses.map((competencia) => ({
    competencia,
    total_centavos: ocorrencias
      .filter((o) => o.competencia.slice(0, 10) === competencia && o.status === 'paga' && o.valor_centavos != null)
      .reduce((soma, o) => soma + (o.valor_centavos ?? 0), 0),
  }));
}
```

Append to `lib/empresa-data.ts`:

```ts
/** Ocorrências (de qualquer status) a partir de uma competência — insumo da série de 12 meses. */
export async function listarPagasDesde(competenciaInicial: string): Promise<Ocorrencia[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('empresa_obrigacao_ocorrencias').select(OCORRENCIA_COLS)
    .gte('competencia', competenciaDe(competenciaInicial))
    .eq('status', 'paga')
    .order('competencia');
  return (data ?? []) as Ocorrencia[];
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- lib/custos.test.ts`
Expected: PASS — os 4 testes novos verdes, os 7 antigos continuam verdes.

- [ ] **Step 5: Renderizar a série na aba Custo fixo**

Modify `components/empresa/AbaCustos.tsx`.

No topo, acrescentar aos imports existentes:

```tsx
import { listarPagasDesde } from '@/lib/empresa-data';
import { mesesAnteriores, serieMensalPaga } from '@/lib/custos';
import type { Ocorrencia } from '@/lib/obrigacoes';
```

Acrescentar o estado e carregar junto com o resto (dentro de `recarregar`):

```tsx
  const [pagas, setPagas] = useState<Ocorrencia[]>([]);
```

```tsx
  const recarregar = useCallback(async () => {
    setLoading(true);
    setCustos(await listarCustos());
    setModelos(await listarModelos());
    const meses = mesesAnteriores(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }), 12);
    setPagas(await listarPagasDesde(meses[0]));
    setLoading(false);
  }, []);
```

E, antes do `</div>` final, a seção da série — barras em CSS puro, sem biblioteca de gráfico para uma lista de 12 números:

```tsx
      <section className="admin-card">
        <h2>Pago nos últimos 12 meses</h2>
        <p style={{ fontSize: '0.75rem', opacity: 0.6 }}>
          Só obrigações já pagas e com valor informado. Serve para enxergar custo em alta.
        </p>
        {(() => {
          const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
          const serie = serieMensalPaga(pagas, mesesAnteriores(hoje, 12));
          const teto = Math.max(...serie.map((s) => s.total_centavos), 1);
          return (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.4rem', height: 140, marginTop: '1rem' }}>
              {serie.map((s) => (
                <div key={s.competencia} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}
                  title={`${s.competencia.slice(0, 7)}: ${formatBRL(s.total_centavos)}`}>
                  <div style={{
                    width: '100%',
                    height: `${Math.round((s.total_centavos / teto) * 100)}%`,
                    minHeight: 2,
                    background: 'var(--gold, #d4a04a)',
                    borderRadius: '2px 2px 0 0',
                    opacity: s.total_centavos === 0 ? 0.15 : 0.85,
                  }} />
                  <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>{s.competencia.slice(5, 7)}</span>
                </div>
              ))}
            </div>
          );
        })()}
      </section>
```

- [ ] **Step 6: Verificar no app**

Run: `npx tsc --noEmit` → sem erros.
Run: `npm run dev -- -p 3333`, aba Custo fixo.
Expected: 12 barras (o mês corrente à direita). O mês em que você marcou o contador como pago mostra R$ 900,00 no tooltip; os demais aparecem esmaecidos em zero.

- [ ] **Step 7: Commit**

```bash
git add lib/custos.ts lib/custos.test.ts lib/empresa-data.ts components/empresa/AbaCustos.tsx
git commit -m "feat(empresa): serie de 12 meses do que foi efetivamente pago"
```

---

## Deploy

**Só com autorização explícita do Valmir.** Ordem obrigatória:

1. Migration `003_empresa_admin.sql` aplicada no SQL Editor do Supabase (já feita na Task 1 — confirmar que é a mesma versão do arquivo).
2. `npx tsc --noEmit` e `npm run build` verdes.
3. `node scripts/verify-empresa-rls.mjs ...` verde.
4. Push na `main` → Vercel deploya sozinho.
5. Em produção: abrir `/empresa`, confirmar que a aba Identidade carrega e que `/agenda` mostra o compromisso espelhado.
