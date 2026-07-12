import { describe, it, expect } from 'vitest';
import { validarForm, type FormInput } from './agenda-data';

const form = (f: Partial<FormInput>): FormInput => ({
  usuario_id: 'u1', titulo: 'Reunião', data: '', hora: '09:00',
  recorrencia: 'nenhuma', dias_semana: [], dia_mes: 1,
  antecedencia_min: 30, descricao: '', ...f,
});

describe('validarForm', () => {
  it('único válido', () => {
    expect(validarForm(form({ recorrencia: 'nenhuma', data: '2026-07-20' }))).toBeNull();
  });

  it('mensal com dia inteiro válido', () => {
    expect(validarForm(form({ recorrencia: 'mensal', dia_mes: 15 }))).toBeNull();
  });

  // O input type=number aceita "15.5"; o CHECK do banco é integer e devolve
  // "invalid input syntax for type integer" cru. Barrar aqui, como a Sofia faz.
  it('mensal com dia fracionário é rejeitado', () => {
    expect(validarForm(form({ recorrencia: 'mensal', dia_mes: 15.5 }))).toBe('Escolha o dia do mês (1 a 31).');
  });

  it('mensal fora da faixa é rejeitado', () => {
    expect(validarForm(form({ recorrencia: 'mensal', dia_mes: 32 }))).toBe('Escolha o dia do mês (1 a 31).');
    expect(validarForm(form({ recorrencia: 'mensal', dia_mes: 0 }))).toBe('Escolha o dia do mês (1 a 31).');
  });

  it('mensal com NaN (input vazio) é rejeitado', () => {
    expect(validarForm(form({ recorrencia: 'mensal', dia_mes: NaN }))).toBe('Escolha o dia do mês (1 a 31).');
  });
});
