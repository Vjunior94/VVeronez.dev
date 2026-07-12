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

## Gotcha: SQL Editor do Supabase
Quebra o script nos `;` internos de um bloco `do $$ ... $$` (`syntax error at end of input`).
Evite blocos `do`; use tag única no corpo de funções (`$fn$ ... $fn$`).

## Deploy
Push na `main` → **Vercel deploya automaticamente**. Rodar `npx tsc --noEmit` e `npm run build`
antes. Migrations de banco são aplicadas **manualmente** no SQL Editor, **antes** do push.
