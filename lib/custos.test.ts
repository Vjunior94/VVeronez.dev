import { describe, it, expect } from 'vitest';
import {
  custoMensalEmBRL, custoFixoTotalMensal, custoObrigacoesMensal, mesesAnteriores, serieMensalPaga,
  type CustoFixo,
} from './custos';
import type { ModeloObrigacao, Ocorrencia } from './obrigacoes';

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
  it('soma mensal (valor cheio), variável (null) fica de fora, e inativa fica de fora', () => {
    const total = custoObrigacoesMensal([
      modelo({ id: 'contador', valor_padrao_centavos: 90000 }),
      modelo({ id: 'das', valor_padrao_centavos: null }),                 // variável: não entra
      modelo({ id: 'velha', valor_padrao_centavos: 50000, ativo: false }), // inativa: não entra
    ]);
    expect(total).toBe(90000);
  });

  // I1: uma obrigação anual (ex.: renovação do certificado digital, R$ 1.200/ano) pesa no
  // orçamento tanto quanto uma assinatura anual — e essa já é diluída ÷12 em custoMensalEmBRL.
  it('anual é diluído ÷12', () => {
    const total = custoObrigacoesMensal([
      modelo({ id: 'certificado', periodicidade: 'anual', mes_vencimento: 1, valor_padrao_centavos: 120000 }),
    ]);
    expect(total).toBe(10000); // 1200,00 / 12 = 100,00/mês
  });

  // Trimestral vence 4x ao ano — dilui ÷3, não ÷12.
  it('trimestral é diluído ÷3 (vence 4x ao ano)', () => {
    const total = custoObrigacoesMensal([
      modelo({ id: 'irpj', periodicidade: 'trimestral', mes_vencimento: 1, valor_padrao_centavos: 30000 }),
    ]);
    expect(total).toBe(10000); // 300,00 / 3 = 100,00/mês
  });

  // 'unica' não é recorrente — não faz sentido diluir num "custo fixo mensal".
  it('única fica de fora (não é recorrente)', () => {
    const total = custoObrigacoesMensal([
      modelo({ id: 'abertura', periodicidade: 'unica', vencimento_unico: '2026-01-10', valor_padrao_centavos: 60000 }),
    ]);
    expect(total).toBe(0);
  });

  it('soma mensal + anual + trimestral juntos, ignorando variável/inativa/única', () => {
    const total = custoObrigacoesMensal([
      modelo({ id: 'contador', periodicidade: 'mensal', valor_padrao_centavos: 90000 }),
      modelo({ id: 'certificado', periodicidade: 'anual', mes_vencimento: 1, valor_padrao_centavos: 120000 }),
      modelo({ id: 'irpj', periodicidade: 'trimestral', mes_vencimento: 1, valor_padrao_centavos: 30000 }),
      modelo({ id: 'das', valor_padrao_centavos: null }),
      modelo({ id: 'velha', valor_padrao_centavos: 50000, ativo: false }),
      modelo({ id: 'abertura', periodicidade: 'unica', vencimento_unico: '2026-01-10', valor_padrao_centavos: 60000 }),
    ]);
    expect(total).toBe(90000 + 10000 + 10000);
  });
});

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
