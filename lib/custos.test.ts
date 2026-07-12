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
