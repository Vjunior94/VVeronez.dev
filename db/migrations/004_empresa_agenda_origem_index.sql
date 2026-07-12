-- ============================================================
-- 004_empresa_agenda_origem_index.sql — corrige o índice do espelho
-- empresa → agenda (bug C1 da revisão da Task 5).
--
-- O que estava errado: `agenda_origem_unica` (criado na 003) era um índice
-- PARCIAL (`where origem is not null`). O PostgREST/supabase-js resolve
-- `upsert(..., { onConflict })` via `ON CONFLICT (origem, origem_id)` SEM
-- cláusula `where` — e o Postgres só infere um índice a partir de um
-- `ON CONFLICT` sem `where` se o índice também não tiver `where`. Como o
-- nosso tinha, TODO upsert do espelho falhava com 42P10
-- ("no unique or exclusion constraint matching the ON CONFLICT
-- specification"), sempre. Confirmado rodando contra o Postgres de
-- produção.
--
-- Por que o índice cheio (sem `where`) continua correto: o `where origem
-- is not null` era redundante desde o início. Postgres trata cada NULL
-- como distinto de qualquer outro valor em índices únicos por padrão —
-- então um índice único cheio em (origem, origem_id) já permite
-- infinitos compromissos "normais" (origem/origem_id nulos, criados a
-- mão na agenda) sem colidir entre si. O `where` só existia para (na
-- teoria) deixar o índice menor, e isso quebrou a inferência do upsert.
-- NÃO reintroduza o `where` aqui — é ele que causa o 42P10.
--
-- Idempotente. Sem bloco `do $$ ... $$` (o SQL Editor do Supabase quebra
-- o script nos `;` internos desse tipo de bloco).
-- Já aplicado manualmente em produção; esta migration só versiona o
-- estado atual do banco para quem rodar a 003 + 004 do zero.
-- ============================================================

begin;

drop index if exists public.agenda_origem_unica;

create unique index agenda_origem_unica
  on public.agenda_compromissos (origem, origem_id);

commit;
