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
