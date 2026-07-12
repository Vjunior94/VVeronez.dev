<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Dashboard vveronez.dev — contexto essencial

## ⚠️ Leia antes de mexer em auth, RLS, `proxy.ts` ou `app/(app)/**`

**`docs/AGENDA_E_AUTH_MULTIUSUARIO.md`** — o modelo de segurança mudou: o dashboard **não é mais
single-admin**. Existem dois níveis de usuário logado (Valmir admin; Henrique comum), e o
isolamento entre eles é a **RLS do Supabase**, não o código React.

Três coisas que se erradas causam vazamento de dados:
1. **`authenticated` não é mais sinônimo de admin.** Qualquer `grant ... to authenticated` no banco é
   alcançável por um não-admin. Tabela/view nova nasce protegida por RLS.
2. **Criar policy em tabela sem `enable row level security` é no-op silencioso** — a tabela fica
   aberta e nada avisa. Sempre habilite explicitamente.
3. **O `proxy.ts` é só UX.** Rotas novas nascem admin-only (deny-by-default); só entram em
   `AUTENTICADO_PREFIXES` se a RLS garantir a autorização real.

Ao mexer na RLS, rodar **`scripts/verify-agenda-rls.mjs`** (ele tenta ativamente vazar e falha se
conseguir). Um `npm run build` verde **não prova nada** sobre isolamento.

## Banco compartilhado
O Supabase é **o mesmo** do backend da Sofia (`Vjunior94/sofia-secretaria`), que acessa via
**service_role (BYPASSRLS)**. Mudanças de RLS não afetam o backend. As tabelas de agenda são a
**fonte única** entre o painel e o WhatsApp.

## Service worker (`public/sw.js`) — regra dura

**Só cacheia ASSET ESTÁTICO (ícones, manifest). NUNCA HTML.** Cachear página autenticada não traz
benefício nenhum e grava no disco a casca de telas logadas, servida offline **sem checar sessão**.
Por isso navegação (`request.mode === 'navigate'`) **nem passa pelo cache** e a allowlist `cacheavel()`
é só `/icons/*` e `/manifest.webmanifest`.

> Precisão importa aqui: **não houve vazamento de dado de cliente.** Foi verificado — as páginas do
> painel são client components, o HTML cacheado era só a casca, e o JSON do Supabase é cross-origin
> (`response.type !== 'basic'`), então nunca foi cacheado. A regra existe porque cachear HTML logado é
> risco sem upside, **não** porque houve incidente. Não repita a versão dramática.

**Ao mudar o que se cacheia, SUBA o `CACHE_NAME`** (hoje `vveronez-v3`). É o handler de `activate`
que apaga as versões antigas — é ele, e só ele, que expulsa do disco dos usuários o que já foi
gravado errado. Mudar a regra sem subir a versão deixa o lixo antigo lá.

## Testes e lint

- **`npm test`** (`vitest run`). `vitest.config.ts` existe só para resolver o alias `@/`.
  Testes atuais: `lib/ocorrencia.test.ts` e `lib/agenda-data.test.ts`.
- **`npm run build` NÃO roda testes nem lint.** Verde no build não prova nada.
- **`npm run lint` JÁ FALHA na `main`**: ~70 problemas (43 erros) — `any`s, imports não usados e
  `<a>` em vez de `<Link>` em telas antigas. **Dívida PRÉ-EXISTENTE**, não regressão do seu diff.
  Compare com a `main` antes de culpar a própria mudança.

## `lib/ocorrencia.ts` é uma CÓPIA ⚠️

É espelho de `backend/src/agent/ocorrencia.ts` do repo da Sofia (`Vjunior94/sofia-secretaria`).
**Não há monorepo nem pacote compartilhado: mudou num, mude no outro.** Foi por isso que o `vitest`
entrou aqui — rode `npm test` ao tocar nesse arquivo.

## Agenda: recorrência SEM DATA

`inicio_em` não faz mais papel duplo:
- **único** (`recorrencia = 'nenhuma'`) → `inicio_em` (timestamptz); `hora_base`/`dias_semana`/`dia_mes` nulos.
- **recorrente** (`diaria` | `semanal` | `mensal`) → `inicio_em` **NULL** + `hora_base` (`time`) +
  (`dias_semana` para semanal | `dia_mes` 1..31 para mensal).

Um **CHECK no banco** (migration `004`, **já aplicada**, mora no repo da Sofia) torna o estado
incoerente irrepresentável. **`validarForm` em `lib/agenda-data.ts` espelha esse CHECK** — mudou um,
mude o outro (e a `validarEntrada` do backend).

## Gotcha: SQL Editor do Supabase
Quebra o script nos `;` internos de um bloco `do $$ ... $$` (`syntax error at end of input`).
Evite blocos `do`; use tag única no corpo de funções (`$fn$ ... $fn$`).

## Deploy
Push na `main` → **Vercel deploya automaticamente**. Rodar `npx tsc --noEmit`, `npm run build` e
`npm test` antes. Migrations de banco são aplicadas **manualmente** no SQL Editor, **antes** do push.

⚠️ **Quando backend da Sofia e dashboard mudam juntos: BACKEND PRIMEIRO.** O painel grava recorrente
com `inicio_em` nulo, e um backend antigo não sabe ler essa linha. Como push na `main` daqui deploya
sozinho, pushar o dashboard antes do backend estar no ar é o jeito de quebrar os lembretes em produção.
