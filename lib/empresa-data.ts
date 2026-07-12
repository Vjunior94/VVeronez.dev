import { createClient } from '@/lib/supabase/client';
import type { CustoFixo } from '@/lib/custos';
import { spParaInstante } from '@/lib/tempo';
import {
  competenciaDe, planoDeMaterializacao,
  type ModeloObrigacao, type Ocorrencia, type Periodicidade,
} from '@/lib/obrigacoes';

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
// validade: string | null (não só string | undefined) — M1: o <input type="date"> manda ''
// ao ser limpo, e nós normalizamos pra null antes de salvar (coluna `date` do Postgres não
// aceita '').
export interface Certificado { tipo?: 'A1' | 'A3'; emissor?: string; validade?: string | null }

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

/** "1.234,56" | "20.50" | "20" → centavos inteiros. null se não for número, for AMBÍGUO
 *  (ver comentário abaixo) ou for negativo. Não adivinha: em campo de dinheiro, chutar
 *  errado é pior que rejeitar. Use `motivoValorInvalido` pra dar a mensagem certa. */
export function reaisParaCentavos(v: string): number | null {
  const bruto = v.trim();
  if (!bruto) return null;
  if (valorAmbiguo(bruto)) return null;
  // Só trata "." como separador de milhar quando há vírgula decimal ("1.234,56").
  // Sem vírgula, "." é o próprio separador decimal ("20.50") — remover ele quebraria esse formato.
  const limpo = bruto.includes(',') ? bruto.replace(/\./g, '').replace(',', '.') : bruto;
  const n = Number(limpo);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null; // custo negativo REDUZ o total em vez de somar — não faz sentido aqui.
  // Math.round e não truncamento: 20.15 * 100 dá 2014.9999... em ponto flutuante.
  return Math.round(n * 100);
}

/** "1.200" sem vírgula é ambíguo: o brasileiro digita pensando em separador de milhar
 *  (R$ 1.200,00) e sem vírgula decimal explícita não há como distinguir de "1 real e 200".
 *  Regra: tem "." e NÃO tem "," (senão o formato BR "1.234,56" já resolve sozinho), e o
 *  último grupo após o ponto tem exatamente 3 dígitos → ambíguo. "20.50" (2 dígitos) e
 *  "20.5" continuam decimais normais — só o grupo de 3 dígitos é suspeito de milhar. */
function valorAmbiguo(bruto: string): boolean {
  if (!bruto.includes('.') || bruto.includes(',')) return false;
  const grupos = bruto.split('.');
  return /^\d{3}$/.test(grupos[grupos.length - 1]);
}

/** Mensagem específica pro porquê de `reaisParaCentavos` ter rejeitado — usada pelas
 *  telas de validação (validarCusto/validarObrigacao) pra não devolver "Valor inválido."
 *  genérico quando o problema real é ambiguidade ou sinal negativo. */
function motivoValorInvalido(v: string): string {
  const bruto = v.trim();
  if (valorAmbiguo(bruto)) return 'Valor ambíguo: use vírgula para os centavos, ex.: 1200,00.';
  const limpo = bruto.includes(',') ? bruto.replace(/\./g, '').replace(',', '.') : bruto;
  const n = Number(limpo);
  if (Number.isFinite(n) && n < 0) return 'Valor não pode ser negativo.';
  return 'Valor inválido.';
}

export function validarCusto(input: CustoInput): string | null {
  if (!input.nome.trim()) return 'Nome é obrigatório.';
  if (reaisParaCentavos(input.valor_reais) == null) return motivoValorInvalido(input.valor_reais);
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
  const { data, error } = await supabase.from('empresa_custos_fixos').select(CUSTO_COLS).order('nome');
  // Lança em vez de devolver [] (mesmo critério de listarModelos): silenciar aqui faz
  // a aba Custo fixo mostrar "nenhuma assinatura cadastrada" quando a query falhou —
  // numa tela de dinheiro, "não tem dado" e "falhou" não podem parecer a mesma coisa.
  if (error) throw new Error(error.message);
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
  if (input.periodicidade === 'anual' || input.periodicidade === 'trimestral') {
    if (!input.mes_vencimento) {
      return input.periodicidade === 'anual'
        ? 'Obrigação anual precisa do mês de vencimento.'
        : 'Obrigação trimestral precisa do mês de referência.';
    }
    // M2: sem isto, digitar 99 vira violação de CHECK crua do Postgres em vez de mensagem em pt-BR.
    if (!Number.isInteger(input.mes_vencimento) || input.mes_vencimento < 1 || input.mes_vencimento > 12) {
      return 'Mês de vencimento deve ficar entre 1 e 12.';
    }
  }
  if (input.valor_padrao_reais.trim() && reaisParaCentavos(input.valor_padrao_reais) == null) {
    return motivoValorInvalido(input.valor_padrao_reais);
  }
  return null;
}

export async function listarModelos(): Promise<ModeloObrigacao[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from('empresa_obrigacoes').select(MODELO_COLS).eq('ativo', true).order('nome');
  // Lança em vez de devolver []: silenciar aqui faz a tela mostrar "nenhuma
  // obrigação" quando na verdade a query falhou — a pior mensagem numa tela
  // cujo propósito é não perder prazo de DAS.
  if (error) throw new Error(error.message);
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

/**
 * Soft-delete do modelo + limpeza em cascata das ocorrências ainda pendentes:
 * sem isso, a Sofia seguiria mandando "Vence hoje: X" no WhatsApp de uma
 * obrigação que o Valmir acabou de apagar. Ocorrências já `paga` não são
 * tocadas — são histórico.
 *
 * ORDEM DAS DUAS ÚLTIMAS ETAPAS É DE PROPÓSITO (e é contraintuitiva — não troque
 * de volta): primeiro desativa os `agenda_compromissos` espelhados, DEPOIS
 * dispensa as `empresa_obrigacao_ocorrencias`. Parece "errado" porque a leitura
 * natural seria "dispensa a ocorrência, depois limpa o espelho dela". Mas é
 * exatamente essa ordem que torna o retry uma mentira: se a chamada dispensasse
 * as ocorrências primeiro e a etapa da agenda falhasse (rede, erro transitório),
 * o estado ficaria com ocorrências já `dispensada` e espelhos ainda `ativo =
 * true`. Ao clicar "remover" de novo, a busca abaixo filtra `status =
 * 'pendente'` — não acha mais nada, devolve `{ error: null }` (sucesso falso) e
 * os espelhos NUNCA MAIS são desativados. A Sofia continuaria mandando "Vence
 * hoje: X" no WhatsApp de uma obrigação que já foi apagada — o bug exato que
 * esta função existe para matar.
 *
 * Com a agenda desativada primeiro: se essa etapa falhar, a ocorrência
 * continua `pendente` e a re-execução encontra ela de novo, refazendo as duas
 * etapas do zero. Se a agenda tiver sucesso mas a dispensa falhar, o retry
 * repete a etapa da agenda (no-op idempotente: `ativo = false` de novo) e
 * então dispensa. Nas duas ordens de falha o retry converge para o estado
 * correto — o que não acontecia antes.
 */
export async function removerObrigacao(id: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.from('empresa_obrigacoes').update({ ativo: false }).eq('id', id);
  if (error) return { error: error.message };

  const { data: pendentes, error: erroBusca } = await supabase
    .from('empresa_obrigacao_ocorrencias')
    .select('id')
    .eq('obrigacao_id', id)
    .eq('status', 'pendente');
  if (erroBusca) return { error: erroBusca.message };

  const idsPendentes = (pendentes ?? []).map((o) => o.id as string);
  if (idsPendentes.length === 0) return { error: null };

  // Mesmo espelho que marcarPaga desativa: origem/origem_id apontam pra ocorrência.
  // Vai ANTES da dispensa — ver o porquê no comentário acima da função.
  const { error: erroAgenda } = await supabase
    .from('agenda_compromissos')
    .update({ ativo: false })
    .eq('origem', 'empresa_obrigacao')
    .in('origem_id', idsPendentes);
  if (erroAgenda) return { error: erroAgenda.message };

  const { error: erroDispensa } = await supabase
    .from('empresa_obrigacao_ocorrencias')
    .update({ status: 'dispensada', atualizado_em: new Date().toISOString() })
    .in('id', idsPendentes);
  return { error: erroDispensa?.message ?? null };
}

/** A linha em `usuarios` ligada ao auth de quem está logado (dono do compromisso espelhado). */
export async function meuUsuarioId(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from('usuarios').select('id').eq('auth_user_id', user.id).maybeSingle();
  // null aqui só pode significar "não achei linha" (caso legítimo, tratado em
  // garantirOcorrencias) — uma falha de query lança, não vira null disfarçado.
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

export interface EspelhoAgenda {
  usuario_id: string; titulo: string; descricao: string;
  inicio_em: string; hora_base: null;
  recorrencia: 'nenhuma'; dias_semana: null; dia_mes: null;
  antecedencia_min: number; origem: 'empresa_obrigacao'; origem_id: string;
}

/**
 * Monta o payload dos compromissos espelhados a partir das ocorrências pendentes.
 * Pura (sem I/O) para dar pra testar sem banco.
 *
 * `hora_base`/`dias_semana`/`dia_mes` explícitos como null (espelha `payload()`
 * em lib/agenda-data.ts): hoje ficam omitidos e dependem do default NULL da
 * coluna, mas o CHECK de coerência recorrência↔campos mora no repo da Sofia —
 * um default futuro ali quebraria só este insert sem avisar.
 *
 * `nomePorId` só tem entrada pros modelos ATIVOS: quem chama monta esse mapa a
 * partir de `listarModelos()`, que já filtra `ativo = true`. Por isso ele também
 * serve pra filtrar, não só pra achar o nome — uma ocorrência `pendente` cujo
 * `obrigacao_id` não está no mapa é órfã de um modelo já removido (ex.: a busca
 * de `listarOcorrencias` traz o mês inteiro sem olhar pro modelo). Sem esse
 * filtro ela viraria um espelho com o título de fallback "obrigação da
 * empresa" — a Sofia cobraria no WhatsApp algo que já foi apagado, e o
 * fallback bonito esconderia o sintoma em vez de revelar o dado órfão.
 */
export function montarEspelhos(
  ocorrencias: Ocorrencia[], nomePorId: Map<string, string>, dono: string,
): EspelhoAgenda[] {
  return ocorrencias
    .filter((o) => o.status === 'pendente')
    .filter((o) => nomePorId.has(o.obrigacao_id))
    .map((o) => ({
      usuario_id: dono,
      titulo: `Vence hoje: ${nomePorId.get(o.obrigacao_id) ?? 'obrigação da empresa'}`,
      descricao: 'Obrigação da empresa (criado pela página /empresa).',
      // 09:00 no fuso de SP, mesma função que a agenda usa pra compromisso único.
      inicio_em: spParaInstante(o.vencimento, '09:00'),
      hora_base: null,
      recorrencia: 'nenhuma' as const,
      dias_semana: null,
      dia_mes: null,
      antecedencia_min: 60,
      origem: 'empresa_obrigacao' as const,
      origem_id: o.id,
    }));
}

/**
 * Garante que as ocorrências da competência existem, e espelha cada uma como
 * compromisso na agenda — é assim que o cron de lembretes QUE JÁ EXISTE passa a
 * avisar do DAS no WhatsApp, sem uma linha de código de lembrete aqui.
 *
 * Idempotente nas duas pontas: `ignoreDuplicates` no upsert bate no índice único
 * (obrigacao_id, competencia) das ocorrências, e em (origem, origem_id) na agenda.
 * Chamar dez vezes cria uma vez só.
 *
 * `listarModelos`/`meuUsuarioId`/`listarOcorrencias` lançam se a query falhar
 * (em vez de devolver [] / null em silêncio) — o try/catch aqui é o que
 * converte isso na assinatura pública `{ error }` sem contaminar quem as chama.
 */
export async function garantirOcorrencias(competencia: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  try {
    const modelos = await listarModelos();
    const plano = planoDeMaterializacao(modelos, competenciaDe(competencia));
    if (plano.length === 0) return { error: null };

    const { error } = await supabase
      .from('empresa_obrigacao_ocorrencias')
      .upsert(plano, { onConflict: 'obrigacao_id,competencia', ignoreDuplicates: true });
    if (error) return { error: error.message };

    const dono = await meuUsuarioId();
    if (!dono) {
      // As ocorrências acima JÁ foram gravadas — isto não é "sem dado", é
      // "sem dono pra espelhar". A mensagem tem que deixar as duas coisas claras.
      return {
        error: 'Não consegui identificar seu usuário — as obrigações foram salvas, '
          + 'mas os lembretes no WhatsApp NÃO foram criados.',
      };
    }

    const ocorrencias = await listarOcorrencias(competencia);
    const nomePorId = new Map(modelos.map((m) => [m.id, m.nome]));
    const espelhos = montarEspelhos(ocorrencias, nomePorId, dono);
    if (espelhos.length === 0) return { error: null };

    const { error: erroAgenda } = await supabase
      .from('agenda_compromissos')
      .upsert(espelhos, { onConflict: 'origem,origem_id', ignoreDuplicates: true });
    return { error: erroAgenda?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Falha ao carregar dados da empresa.' };
  }
}

export async function listarOcorrencias(competencia: string): Promise<Ocorrencia[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('empresa_obrigacao_ocorrencias').select(OCORRENCIA_COLS)
    .eq('competencia', competenciaDe(competencia))
    .order('vencimento');
  if (error) throw new Error(error.message);
  return (data ?? []) as Ocorrencia[];
}

/** Ocorrências PAGAS a partir de uma competência — insumo da série de 12 meses. Lança em erro
 *  de query (mesmo critério de listarModelos/listarCustos): ver comentário em listarCustos. */
export async function listarPagasDesde(competenciaInicial: string): Promise<Ocorrencia[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('empresa_obrigacao_ocorrencias').select(OCORRENCIA_COLS)
    .gte('competencia', competenciaDe(competenciaInicial))
    .eq('status', 'paga')
    .order('competencia');
  if (error) throw new Error(error.message);
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
