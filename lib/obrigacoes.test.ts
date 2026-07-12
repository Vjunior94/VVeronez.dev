import { describe, it, expect } from 'vitest';
import {
  competenciaDe, vencimentoNaCompetencia, planoDeMaterializacao, statusExibido, venceEmDias,
  type ModeloObrigacao, type Ocorrencia,
} from './obrigacoes';

const modelo = (m: Partial<ModeloObrigacao>): ModeloObrigacao => ({
  id: 'o1', nome: 'DAS', categoria: 'fiscal', orgao: 'Receita Federal',
  periodicidade: 'mensal', dia_vencimento: 20, mes_vencimento: null, vencimento_unico: null,
  valor_padrao_centavos: null, link_portal: null, observacoes: null, ativo: true, ...m,
});

const ocorrencia = (o: Partial<Ocorrencia>): Ocorrencia => ({
  id: 'oc1', obrigacao_id: 'o1', competencia: '2026-07-01', vencimento: '2026-07-20',
  valor_centavos: null, status: 'pendente', pago_em: null, comprovante_url: null, ...o,
});

describe('competenciaDe', () => {
  it('normaliza qualquer data para o dia 1 do mês', () => {
    expect(competenciaDe('2026-07-12')).toBe('2026-07-01');
    expect(competenciaDe('2026-07-01')).toBe('2026-07-01');
  });
});

describe('vencimentoNaCompetencia', () => {
  it('mensal cai no dia configurado', () => {
    expect(vencimentoNaCompetencia(modelo({ dia_vencimento: 20 }), '2026-07-01')).toBe('2026-07-20');
  });

  // O bug clássico: dia 31 não existe em fevereiro. Sem clamp, `new Date(2026,1,31)`
  // vira 3 de março e a obrigação venceria no mês errado.
  it('mensal com dia 31 em fevereiro é grudado no último dia do mês', () => {
    expect(vencimentoNaCompetencia(modelo({ dia_vencimento: 31 }), '2026-02-01')).toBe('2026-02-28');
  });

  it('mensal com dia 31 em ano bissexto respeita o 29', () => {
    expect(vencimentoNaCompetencia(modelo({ dia_vencimento: 31 }), '2028-02-01')).toBe('2028-02-29');
  });

  it('anual só vence no mês âncora', () => {
    const defis = modelo({ periodicidade: 'anual', mes_vencimento: 5, dia_vencimento: 31 });
    expect(vencimentoNaCompetencia(defis, '2026-05-01')).toBe('2026-05-31');
    expect(vencimentoNaCompetencia(defis, '2026-07-01')).toBeNull();
  });

  it('trimestral vence no mês âncora e de 3 em 3 meses', () => {
    const t = modelo({ periodicidade: 'trimestral', mes_vencimento: 1, dia_vencimento: 10 });
    expect(vencimentoNaCompetencia(t, '2026-01-01')).toBe('2026-01-10');
    expect(vencimentoNaCompetencia(t, '2026-04-01')).toBe('2026-04-10');
    expect(vencimentoNaCompetencia(t, '2026-03-01')).toBeNull();
  });

  it('única só vence na competência da própria data', () => {
    const u = modelo({ periodicidade: 'unica', dia_vencimento: null, vencimento_unico: '2026-09-15' });
    expect(vencimentoNaCompetencia(u, '2026-09-01')).toBe('2026-09-15');
    expect(vencimentoNaCompetencia(u, '2026-08-01')).toBeNull();
  });

  it('modelo inativo nunca vence', () => {
    expect(vencimentoNaCompetencia(modelo({ ativo: false }), '2026-07-01')).toBeNull();
  });
});

describe('planoDeMaterializacao', () => {
  it('gera uma ocorrência por modelo que vence no mês, com o valor padrão quando fixo', () => {
    const plano = planoDeMaterializacao([
      modelo({ id: 'das', valor_padrao_centavos: null }),
      modelo({ id: 'contador', dia_vencimento: 5, valor_padrao_centavos: 90000 }),
      modelo({ id: 'defis', periodicidade: 'anual', mes_vencimento: 5, dia_vencimento: 31 }),
    ], '2026-07-01');

    expect(plano).toEqual([
      { obrigacao_id: 'das', competencia: '2026-07-01', vencimento: '2026-07-20', valor_centavos: null },
      { obrigacao_id: 'contador', competencia: '2026-07-01', vencimento: '2026-07-05', valor_centavos: 90000 },
    ]);
  });

  it('mês sem nenhuma obrigação devida gera plano vazio', () => {
    const so_anual = modelo({ periodicidade: 'anual', mes_vencimento: 5, dia_vencimento: 31 });
    expect(planoDeMaterializacao([so_anual], '2026-07-01')).toEqual([]);
  });
});

describe('statusExibido', () => {
  it('paga continua paga mesmo com vencimento no passado', () => {
    expect(statusExibido(ocorrencia({ status: 'paga', vencimento: '2026-07-01' }), '2026-07-12')).toBe('paga');
  });

  it('dispensada nunca vira atrasada', () => {
    expect(statusExibido(ocorrencia({ status: 'dispensada', vencimento: '2026-07-01' }), '2026-07-12')).toBe('dispensada');
  });

  it('pendente com vencimento passado é atrasada (derivado, não persistido)', () => {
    expect(statusExibido(ocorrencia({ vencimento: '2026-07-10' }), '2026-07-12')).toBe('atrasada');
  });

  it('pendente vencendo HOJE ainda é pendente, não atrasada', () => {
    expect(statusExibido(ocorrencia({ vencimento: '2026-07-12' }), '2026-07-12')).toBe('pendente');
  });

  it('pendente com vencimento futuro é pendente', () => {
    expect(statusExibido(ocorrencia({ vencimento: '2026-07-20' }), '2026-07-12')).toBe('pendente');
  });
});

describe('venceEmDias', () => {
  it('conta dias até o vencimento; negativo quando já passou', () => {
    expect(venceEmDias(ocorrencia({ vencimento: '2026-07-20' }), '2026-07-12')).toBe(8);
    expect(venceEmDias(ocorrencia({ vencimento: '2026-07-12' }), '2026-07-12')).toBe(0);
    expect(venceEmDias(ocorrencia({ vencimento: '2026-07-10' }), '2026-07-12')).toBe(-2);
  });
});
