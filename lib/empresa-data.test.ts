import { describe, it, expect } from 'vitest';
import {
  reaisParaCentavos, validarCusto, alertaCertificado, type CustoInput,
  validarObrigacao, montarEspelhos, type ObrigacaoInput, marcarPaga,
} from './empresa-data';
import type { Ocorrencia } from './obrigacoes';

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

  // I2: "1.200" sem vírgula é ambíguo (mil e duzentos reais, ou 1,20 com ponto decimal?).
  // Adivinhar errado aqui é um erro de 1000x, silencioso, num campo de dinheiro — rejeita.
  it('rejeita "1.200" (ambíguo: sem vírgula, três dígitos após o ponto)', () => {
    expect(reaisParaCentavos('1.200')).toBeNull();
    expect(reaisParaCentavos('12.345')).toBeNull();
  });

  it('continua aceitando decimal com ponto (dois dígitos não é ambíguo)', () => {
    expect(reaisParaCentavos('20.50')).toBe(2050);
  });

  it('continua aceitando formato BR com milhar e decimal', () => {
    expect(reaisParaCentavos('1.234,56')).toBe(123456);
  });

  it('rejeita valor negativo', () => {
    expect(reaisParaCentavos('-50')).toBeNull();
    expect(reaisParaCentavos('-50,00')).toBeNull();
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

  it('valor ambíguo ("1.200") tem mensagem específica, não "Valor inválido." genérico', () => {
    expect(validarCusto(input({ valor_reais: '1.200' })))
      .toBe('Valor ambíguo: use vírgula para os centavos, ex.: 1200,00.');
  });

  it('valor negativo tem mensagem específica', () => {
    expect(validarCusto(input({ valor_reais: '-50' }))).toBe('Valor não pode ser negativo.');
  });
});

describe('marcarPaga', () => {
  // Minor 1 da revisão: o prompt "Marcar paga" reusa o mesmo campo de dinheiro das outras
  // telas — "1.200" precisa da mesma mensagem específica (ambíguo), não "Valor inválido."
  // genérico. A validação roda antes de criar o client do Supabase, então dá pra testar
  // sem mock (não bate na rede).
  it('valor ambíguo tem mensagem específica, não "Valor inválido." genérico', async () => {
    const { error } = await marcarPaga('oc-1', '1.200', '2026-07-12');
    expect(error).toBe('Valor ambíguo: use vírgula para os centavos, ex.: 1200,00.');
  });

  it('valor negativo tem mensagem específica', async () => {
    const { error } = await marcarPaga('oc-1', '-50', '2026-07-12');
    expect(error).toBe('Valor não pode ser negativo.');
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

  // M2: sem isto, 99 vira violação de CHECK crua do Postgres em vez de mensagem em pt-BR.
  it('mês de vencimento fora de 1..12 é rejeitado', () => {
    expect(validarObrigacao(obrig({ periodicidade: 'anual', mes_vencimento: 99 })))
      .toBe('Mês de vencimento deve ficar entre 1 e 12.');
    expect(validarObrigacao(obrig({ periodicidade: 'trimestral', mes_vencimento: 13 })))
      .toBe('Mês de vencimento deve ficar entre 1 e 12.');
  });

  // 0 é falsy: cai no mesmo branch de "não preenchido" (mensagem já coberta acima),
  // não no range check — comportamento correto, só documentando a fronteira.
  it('mês de vencimento zero é tratado como não preenchido', () => {
    expect(validarObrigacao(obrig({ periodicidade: 'trimestral', mes_vencimento: 0 })))
      .toBe('Obrigação trimestral precisa do mês de referência.');
  });

  it('mês de vencimento válido passa', () => {
    expect(validarObrigacao(obrig({ periodicidade: 'anual', mes_vencimento: 12 }))).toBeNull();
  });

  it('única sem data é rejeitada', () => {
    expect(validarObrigacao(obrig({ periodicidade: 'unica', vencimento_unico: '' })))
      .toBe('Obrigação única precisa da data de vencimento.');
  });

  it('valor preenchido inválido é rejeitado', () => {
    expect(validarObrigacao(obrig({ valor_padrao_reais: 'abc' }))).toBe('Valor inválido.');
  });

  it('valor preenchido ambíguo é rejeitado com mensagem específica', () => {
    expect(validarObrigacao(obrig({ valor_padrao_reais: '1.200' })))
      .toBe('Valor ambíguo: use vírgula para os centavos, ex.: 1200,00.');
  });
});

const ocorrencia = (o: Partial<Ocorrencia>): Ocorrencia => ({
  id: 'oc-1', obrigacao_id: 'mod-1', competencia: '2026-07-01', vencimento: '2026-07-20',
  valor_centavos: null, status: 'pendente', pago_em: null, comprovante_url: null, ...o,
});

describe('montarEspelhos', () => {
  const nomePorId = new Map([['mod-1', 'DAS']]);

  it('espelha só ocorrências pendentes (paga/dispensada ficam de fora)', () => {
    const ocorrencias = [
      ocorrencia({ id: 'oc-1', status: 'pendente' }),
      ocorrencia({ id: 'oc-2', status: 'paga' }),
      ocorrencia({ id: 'oc-3', status: 'dispensada' }),
    ];
    const espelhos = montarEspelhos(ocorrencias, nomePorId, 'usuario-1');
    expect(espelhos.map((e) => e.origem_id)).toEqual(['oc-1']);
  });

  it('usa o nome do modelo no título', () => {
    const [comNome] = montarEspelhos([ocorrencia({})], nomePorId, 'usuario-1');
    expect(comNome.titulo).toBe('Vence hoje: DAS');
  });

  // nomePorId só contém modelos ATIVOS (é assim que quem chama monta o mapa, a
  // partir de listarModelos()). Uma ocorrência pendente cujo obrigacao_id não
  // está lá é órfã de um modelo já removido — não pode virar espelho na agenda,
  // senão a Sofia cobra no WhatsApp uma obrigação que não existe mais.
  it('não espelha ocorrência pendente de obrigação que não está entre os modelos ativos', () => {
    const ocorrencias = [
      ocorrencia({ id: 'oc-1', obrigacao_id: 'mod-1' }),
      ocorrencia({ id: 'oc-2', obrigacao_id: 'mod-removido' }),
    ];
    const espelhos = montarEspelhos(ocorrencias, nomePorId, 'usuario-1');
    expect(espelhos.map((e) => e.origem_id)).toEqual(['oc-1']);
  });

  // M1: hora_base/dias_semana/dia_mes explícitos como null, espelhando payload()
  // de lib/agenda-data.ts — não pode depender do default da coluna.
  it('grava hora_base, dias_semana e dia_mes explicitamente como null', () => {
    const [espelho] = montarEspelhos([ocorrencia({})], nomePorId, 'usuario-1');
    expect(espelho.hora_base).toBeNull();
    expect(espelho.dias_semana).toBeNull();
    expect(espelho.dia_mes).toBeNull();
    expect(espelho.recorrencia).toBe('nenhuma');
  });

  // M3: mesmo horário (09:00 -03:00) que o código antigo montava na mão,
  // agora via spParaInstante — não duplicar o offset.
  it('inicio_em é 09:00 no fuso de SP (meio-dia UTC)', () => {
    const [espelho] = montarEspelhos([ocorrencia({ vencimento: '2026-07-20' })], nomePorId, 'usuario-1');
    expect(espelho.inicio_em).toBe('2026-07-20T12:00:00.000Z');
  });

  it('origem e usuario_id vêm corretos pro upsert em (origem, origem_id)', () => {
    const [espelho] = montarEspelhos([ocorrencia({ id: 'oc-9' })], nomePorId, 'usuario-1');
    expect(espelho.origem).toBe('empresa_obrigacao');
    expect(espelho.origem_id).toBe('oc-9');
    expect(espelho.usuario_id).toBe('usuario-1');
  });
});
