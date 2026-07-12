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
