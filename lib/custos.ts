// Custo fixo de manter a empresa viva. Módulo PURO.
// Tudo em centavos inteiros (igual ao resto do app — lib/format.ts::formatBRL).
// A cotação do dólar é um número que o Valmir mantém à mão (cotacao_usd_centavos
// em empresa_dados): sem API externa, sem dependência que quebra de madrugada.

import type { ModeloObrigacao, Ocorrencia } from './obrigacoes';

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

/** Obrigações entram no custo fixo quando são RECORRENTES de valor FIXO conhecido.
 *  A spec pede "soma das obrigações recorrentes de valor fixo", não "só as mensais": uma
 *  obrigação anual (ex.: renovação do certificado digital) pesa tanto no orçamento quanto
 *  uma assinatura anual — e essa já é diluída acima, em `custoMensalEmBRL`. Diluímos aqui
 *  do mesmo jeito: anual ÷12, trimestral ÷3 (vence 4x/ano). `unica` fica de fora (não é
 *  recorrente) e o DAS (valor variável, `valor_padrao_centavos = null`) fica de fora:
 *  chutar um número aqui seria pior que omitir. */
export function custoObrigacoesMensal(modelos: ModeloObrigacao[]): number {
  return modelos
    .filter((m) => m.ativo && m.valor_padrao_centavos != null)
    .reduce((soma, m) => {
      const valor = m.valor_padrao_centavos ?? 0;
      if (m.periodicidade === 'mensal') return soma + valor;
      if (m.periodicidade === 'anual') return soma + Math.round(valor / 12);
      if (m.periodicidade === 'trimestral') return soma + Math.round(valor / 3);
      return soma; // 'unica': não é recorrente, não entra no custo fixo mensal.
    }, 0);
}

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
