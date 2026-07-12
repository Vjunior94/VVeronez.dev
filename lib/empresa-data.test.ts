import { describe, it, expect } from 'vitest';
import { reaisParaCentavos, validarCusto, alertaCertificado, type CustoInput } from './empresa-data';
import { validarObrigacao, type ObrigacaoInput } from './empresa-data';

const input = (c: Partial<CustoInput>): CustoInput => ({
  nome: 'Vercel', categoria: 'infra', valor_reais: '20,00',
  moeda: 'BRL', ciclo: 'mensal', dia_cobranca: 1, url: '', ...c,
});

describe('reaisParaCentavos', () => {
  it('aceita o formato brasileiro com vírgula', () => {
    expect(reaisParaCentavos('20,00')).toBe(2000);
    expect(reaisParaCentavos('1.234,56')).toBe(123456);
  });

  it('aceita ponto como decimal e valor inteiro', () => {
    expect(reaisParaCentavos('20.50')).toBe(2050);
    expect(reaisParaCentavos('20')).toBe(2000);
  });

  it('rejeita vazio e lixo', () => {
    expect(reaisParaCentavos('')).toBeNull();
    expect(reaisParaCentavos('abc')).toBeNull();
  });

  // Ponto flutuante: 20.15 * 100 = 2014.9999... Sem arredondar, o banco (integer) receberia 2014.
  it('arredonda o centavo em vez de truncar', () => {
    expect(reaisParaCentavos('20,15')).toBe(2015);
  });
});

describe('validarCusto', () => {
  it('custo válido passa', () => {
    expect(validarCusto(input({}))).toBeNull();
  });

  it('nome vazio é rejeitado', () => {
    expect(validarCusto(input({ nome: '  ' }))).toBe('Nome é obrigatório.');
  });

  it('valor inválido é rejeitado', () => {
    expect(validarCusto(input({ valor_reais: 'abc' }))).toBe('Valor inválido.');
  });

  it('dia de cobrança fora da faixa é rejeitado (o CHECK do banco é 1..31)', () => {
    expect(validarCusto(input({ dia_cobranca: 32 }))).toBe('Dia da cobrança deve ficar entre 1 e 31.');
    expect(validarCusto(input({ dia_cobranca: 0 }))).toBe('Dia da cobrança deve ficar entre 1 e 31.');
  });

  it('dia de cobrança vazio é aceito (é opcional)', () => {
    expect(validarCusto(input({ dia_cobranca: null }))).toBeNull();
  });
});

describe('alertaCertificado', () => {
  it('sem validade cadastrada não alerta', () => {
    expect(alertaCertificado({}, '2026-07-12')).toBeNull();
  });

  it('validade distante é ok', () => {
    expect(alertaCertificado({ validade: '2027-01-01' }, '2026-07-12')).toEqual({ dias: 173, nivel: 'ok' });
  });

  // Certificado vencido trava emissão de nota — o aviso precisa aparecer com folga.
  it('faltando 30 dias ou menos vira atenção', () => {
    expect(alertaCertificado({ validade: '2026-08-11' }, '2026-07-12')).toEqual({ dias: 30, nivel: 'atencao' });
  });

  it('vencido é vencido', () => {
    expect(alertaCertificado({ validade: '2026-07-11' }, '2026-07-12')).toEqual({ dias: -1, nivel: 'vencido' });
  });
});

const obrig = (o: Partial<ObrigacaoInput>): ObrigacaoInput => ({
  nome: 'DAS', categoria: 'fiscal', orgao: 'Receita Federal', periodicidade: 'mensal',
  dia_vencimento: 20, mes_vencimento: null, vencimento_unico: '',
  valor_padrao_reais: '', link_portal: '', observacoes: '', ...o,
});

describe('validarObrigacao', () => {
  it('mensal com dia válido passa; valor vazio = variável (DAS)', () => {
    expect(validarObrigacao(obrig({}))).toBeNull();
  });

  it('nome vazio é rejeitado', () => {
    expect(validarObrigacao(obrig({ nome: ' ' }))).toBe('Nome é obrigatório.');
  });

  it('mensal sem dia de vencimento é rejeitado', () => {
    expect(validarObrigacao(obrig({ dia_vencimento: null }))).toBe('Escolha o dia do vencimento (1 a 31).');
  });

  // O input type=number aceita 15.5; a coluna é integer e o Postgres devolveria erro cru.
  it('dia fracionário é rejeitado', () => {
    expect(validarObrigacao(obrig({ dia_vencimento: 15.5 }))).toBe('Escolha o dia do vencimento (1 a 31).');
  });

  it('anual sem mês âncora é rejeitado', () => {
    expect(validarObrigacao(obrig({ periodicidade: 'anual', mes_vencimento: null })))
      .toBe('Obrigação anual precisa do mês de vencimento.');
  });

  it('única sem data é rejeitada', () => {
    expect(validarObrigacao(obrig({ periodicidade: 'unica', vencimento_unico: '' })))
      .toBe('Obrigação única precisa da data de vencimento.');
  });

  it('valor preenchido inválido é rejeitado', () => {
    expect(validarObrigacao(obrig({ valor_padrao_reais: 'abc' }))).toBe('Valor inválido.');
  });
});
