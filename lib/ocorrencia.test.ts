import { describe, it, expect } from 'vitest';
import { proximaOcorrencia, ultimoDiaDoMes, descreverRegra, type RegraOcorrencia } from './ocorrencia';

// Offset SP fixo -03:00 → 2026-07-11T10:00 SP === 13:00Z. Sábado.
const agora = new Date('2026-07-11T13:00:00.000Z');
const spIso = (s: string) => new Date(`${s}-03:00`).getTime();

const regra = (r: Partial<RegraOcorrencia>): RegraOcorrencia => ({
  inicio_em: null, hora_base: null, recorrencia: 'nenhuma',
  dias_semana: null, dia_mes: null, ...r,
});

describe('ultimoDiaDoMes', () => {
  it('fevereiro comum: 28', () => expect(ultimoDiaDoMes(2026, 2)).toBe(28));
  it('fevereiro bissexto: 29', () => expect(ultimoDiaDoMes(2028, 2)).toBe(29));
});

describe('proximaOcorrencia', () => {
  it('única futura', () => {
    const alvo = new Date(spIso('2026-07-11T15:00:00')).toISOString();
    expect(proximaOcorrencia(regra({ inicio_em: alvo, recorrencia: 'nenhuma' }), agora)?.toISOString()).toBe(alvo);
  });

  it('única passada retorna null', () => {
    const alvo = new Date(spIso('2026-07-11T08:00:00')).toISOString();
    expect(proximaOcorrencia(regra({ inicio_em: alvo, recorrencia: 'nenhuma' }), agora)).toBeNull();
  });

  it('diária mais tarde hoje', () => {
    const r = proximaOcorrencia(regra({ recorrencia: 'diaria', hora_base: '15:00:00' }), agora);
    expect(r?.getTime()).toBe(spIso('2026-07-11T15:00:00'));
  });

  it('diária já passada: amanhã', () => {
    const r = proximaOcorrencia(regra({ recorrencia: 'diaria', hora_base: '09:00:00' }), agora);
    expect(r?.getTime()).toBe(spIso('2026-07-12T09:00:00'));
  });

  it('semanal seg/qua/sex: segunda 13/07', () => {
    const r = proximaOcorrencia(regra({ recorrencia: 'semanal', hora_base: '07:00:00', dias_semana: [1, 3, 5] }), agora);
    expect(r?.getTime()).toBe(spIso('2026-07-13T07:00:00'));
  });

  it('mensal dia 20: este mês', () => {
    const r = proximaOcorrencia(regra({ recorrencia: 'mensal', hora_base: '08:00:00', dia_mes: 20 }), agora);
    expect(r?.getTime()).toBe(spIso('2026-07-20T08:00:00'));
  });

  it('mensal dia 5 já passou: agosto', () => {
    const r = proximaOcorrencia(regra({ recorrencia: 'mensal', hora_base: '08:00:00', dia_mes: 5 }), agora);
    expect(r?.getTime()).toBe(spIso('2026-08-05T08:00:00'));
  });

  it('mensal dia 31 em fevereiro clampa para 28', () => {
    const emFev = new Date('2026-02-01T13:00:00.000Z');
    const r = proximaOcorrencia(regra({ recorrencia: 'mensal', hora_base: '08:00:00', dia_mes: 31 }), emFev);
    expect(r?.getTime()).toBe(spIso('2026-02-28T08:00:00'));
  });
});

describe('descreverRegra', () => {
  it('diária', () => {
    expect(descreverRegra(regra({ recorrencia: 'diaria', hora_base: '10:00:00' }))).toBe('todo dia às 10:00');
  });
  it('semanal', () => {
    expect(descreverRegra(regra({ recorrencia: 'semanal', hora_base: '07:00:00', dias_semana: [1, 3, 5] })))
      .toBe('seg/qua/sex às 07:00');
  });
  it('mensal', () => {
    expect(descreverRegra(regra({ recorrencia: 'mensal', hora_base: '09:00:00', dia_mes: 5 })))
      .toBe('todo dia 5 às 09:00');
  });
  it('única não tem regra', () => {
    expect(descreverRegra(regra({ recorrencia: 'nenhuma', inicio_em: new Date().toISOString() }))).toBe('');
  });
});
