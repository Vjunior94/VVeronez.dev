# Página Administrativa da Empresa — Design (Fase 1)

**Data:** 2026-07-12
**Status:** aprovado no brainstorming, aguardando plano de implementação
**Escopo desta fase:** identidade da empresa, obrigações legais e custo fixo mensal.
**Fora de escopo (fase 2):** projetos no ar, receita, mensalidades de clientes.

---

## 1. Problema

Hoje os dados da PJ (ME/EPP no Simples Nacional) e suas obrigações vivem espalhados entre e-mails do
contador, memória e planilhas. Três consequências:

1. **Risco de esquecer prazo** — DAS, DEFIS, renovação do certificado digital. Certificado vencido
   trava emissão de nota fiscal.
2. **Consulta lenta** — CNPJ, IE, CNAE são pedidos com frequência e não estão a um clique.
3. **Custo cego** — não existe hoje a resposta para "quanto preciso faturar por mês só para manter a
   empresa viva".

## 2. Decisões travadas no brainstorming

| Decisão | Escolha | Motivo |
|---|---|---|
| Função da página | Os três blocos com peso igual: identidade, obrigações, custo | Pedido do Valmir |
| Onde vivem as obrigações | Tabela própria + espelho em `agenda_compromissos` | A agenda não tem valor, competência nem histórico de pagamento; mas já tem lembrete via WhatsApp — reusamos |
| Credenciais de portais | **Nenhuma senha no banco** | Endpoint de auth do Supabase é público e a senha de admin ainda é fraca; vazamento viraria acesso ao e-CAC |
| Acesso | Só `is_admin()` (só o Valmir) | Henrique é usuário comum sem `acesso_negocio`; CNPJ/impostos são dado sensível |
| Financeiro nesta fase | Só o custo de manter a empresa | Receita entra limpa na fase 2, junto com os projetos — evita retrabalho |
| Anexos | Só link (Drive/OneDrive), sem upload | Zero código de upload, zero contrato social guardado no banco |
| Navegação | Rota única `/empresa` com abas | Fase 2 acrescenta a aba "Projetos" sem mexer em navegação |

## 3. Interface

Rota `app/(admin)/empresa/page.tsx`, três abas. Novo item na sidebar admin (passa de 6 para 7).

### Aba 1 — Identidade

Registro único, em blocos:

- **Cadastro:** razão social, nome fantasia, CNPJ, IE, IM, CNAE principal, CNAEs secundários, regime
  (Simples Nacional — ME/EPP), data de abertura, capital social.
- **Endereço fiscal.**
- **Contador:** nome, escritório, telefone, e-mail, dia do fechamento mensal.
- **Certificado digital:** tipo (A1/A3), emissor, **data de validade**.
- **Portais:** nome + URL + login. **Sem senha** (ver decisão acima).
- **Documentos:** nome + link externo.

Cada campo tem botão de copiar — o uso real desta aba é "preciso do CNPJ agora".

**Alerta de certificado:** faltando ≤ 30 dias para a validade, a página destaca o aviso. Vencimento
de certificado é a falha mais cara e mais boba possível.

### Aba 2 — Obrigações

Topo: faixa de estado com **vencendo em 7 dias**, **atrasadas**, **pagas no mês**.

Corpo: lista das ocorrências do mês corrente (seletor de mês permite navegar). Cada linha: nome,
vencimento, valor, status (pendente / paga / atrasada — sendo "atrasada" derivada, ver §4) e ação
*marcar como paga*.

Cadastro em duas camadas:

- **Modelo recorrente** (`empresa_obrigacoes`) — cadastrado uma vez.
- **Ocorrência do mês** (`empresa_obrigacao_ocorrencias`) — materializada pelo sistema. É o que dá
  histórico ("quanto paguei de DAS em 2026").

Modelos típicos de ME/EPP no Simples são **sugeridos** no cadastro, todos editáveis e removíveis:
DAS mensal, DEFIS anual, pró-labore, INSS, FGTS (se houver funcionário), honorários contábeis,
renovação do certificado digital, alvará.

### Aba 3 — Custo fixo

Número em destaque: **quanto custa manter a empresa por mês**. Soma das obrigações recorrentes de
valor fixo + assinaturas/ferramentas (Vercel, Railway, Supabase, Anthropic, domínio, Z-API).

Valores em dólar são guardados com a moeda e convertidos por uma **cotação definida manualmente**
(campo em `empresa_dados`) — sem API externa, sem dependência que quebra de madrugada.

Abaixo, série dos últimos 12 meses do que foi efetivamente pago, para revelar custo em alta.

## 4. Modelo de dados

Migration `db/migrations/003_empresa_admin.sql`. Sem bloco `do $$ ... $$` (o SQL Editor do Supabase
quebra nos `;` internos). Aplicada **manualmente antes** do deploy do código que a usa.

### `empresa_dados` — registro único

Cadastro, endereço, contador, certificado digital e a cotação do dólar. Portais e documentos ficam
como colunas JSON dentro desta tabela, não em tabelas satélite: são listas curtas lidas só por esta
tela, e uma tabela a menos é uma policy de RLS a menos para errar.

### `empresa_obrigacoes` — modelo recorrente

Nome, categoria (fiscal / contábil / trabalhista / societária), órgão, periodicidade (mensal /
trimestral / anual / única), dia do vencimento, mês do vencimento (para anuais), valor padrão
(nulo quando variável), link do portal, ativo.

### `empresa_obrigacao_ocorrencias` — instância de um período

`obrigacao_id`, competência (mês de referência), vencimento, valor real, status, data de pagamento,
link do comprovante.

**Restrição de unicidade em `(obrigacao_id, competencia)`.** É ela que torna a materialização
idempotente: ao abrir a página, o servidor garante que as ocorrências do mês corrente existem, e
rodar isso dez vezes cria uma vez só. Dispensa um cron novo só para gerar linha.

Dois detalhes que evitam bug real:

- **DAS tem valor variável.** A ocorrência nasce sem valor; preenchido quando o contador informa, ou
  ao marcar como paga. Nada bloqueia por falta de valor.
- **"Atrasada" não é status armazenado, é derivado** (vencimento passado + ainda pendente). Status
  gravado no banco seria uma mentira dependente de um cron que talvez não rode.

Status persistidos: `pendente`, `paga`, `dispensada`.

### `empresa_custos_fixos` — assinaturas e ferramentas

Nome, categoria, valor, moeda (BRL/USD), ciclo (mensal/anual), dia da cobrança, URL, ativo.

## 5. Segurança

- RLS **habilitada explicitamente** nas quatro tabelas. (A migration da agenda ensinou: policy sem
  `enable row level security` é no-op silencioso e deixa a tabela aberta.)
- Policy única por tabela: `is_admin()` em leitura e escrita.
- `revoke all ... from anon` nas quatro.
- Rota em `app/(admin)/` — herda o `proxy.ts` deny-by-default fail-closed.
- **Nenhuma senha de portal, de certificado ou de gov.br é gravada.** Guardamos link e login.

## 6. Integração com a Sofia (agenda)

Cada ocorrência materializada **espelha um compromisso** em `agenda_compromissos`, dono = Valmir,
com marca de origem (`empresa_obrigacao` + id da ocorrência).

Consequência: **nenhuma linha de código de lembrete é escrita**. O cron que já existe e já avisa no
WhatsApp passa a avisar sobre o DAS, e "pagar o contador" aparece na agenda — que é onde um
compromisso deve mesmo aparecer.

**Um único escritor:** o painel escreve, a Sofia lê. Marcar como paga no painel conclui o
compromisso espelhado.

### Estágio 2 (depois, não nesta entrega)

Responder **"pago" pelo WhatsApp** e o status mudar sozinho exige uma tool nova no backend da Sofia.
Fica para depois que a página estiver de pé **e** a sessão que hoje mexe na Agenda tiver dado merge —
para não colidir nos mesmos arquivos.

## 7. Verificação

Reusa o padrão validado na agenda:

1. **Script de RLS por identidade** — usuário comum autenticado lê `empresa_dados` e deve receber
   zero linhas; a tentativa de escrita deve ser **rejeitada** (não apenas "não aparecer"). O script
   **falha** se o probe de escrita não puder rodar — nada de falso "OK" por contagem.
2. **Teste da materialização** — rodar duas vezes no mesmo mês não duplica ocorrência.
3. **Fluxo real no dev (porta 3333)** — cadastrar o contador, marcar o DAS como pago, ver o custo
   fixo somar, confirmar o compromisso espelhado na agenda.

## 8. Arquivos previstos

| Arquivo | Papel |
|---|---|
| `db/migrations/003_empresa_admin.sql` | Tabelas + RLS |
| `app/(admin)/empresa/page.tsx` | Casca com as abas |
| `components/empresa/*` | Um componente por aba, cada um com seu fetch |
| `lib/empresa-data.ts` | Acesso a dados (espelha `lib/agenda-data.ts`) |
| `scripts/verify-empresa-rls.*` | Prova de isolamento |
| sidebar admin | Novo item "Empresa" |
