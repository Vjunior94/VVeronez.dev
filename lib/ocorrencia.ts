// Espelho de SOFIA/backend/src/agent/ocorrencia.ts. Os dois repos duplicam a lógica
// pura de tempo (não há monorepo nem pacote compartilhado) — se mudar aqui, mude lá.
// America/Sao_Paulo, offset fixo -03:00 (Brasil sem DST desde 2019).

const SP_OFFSET_MIN = -180;

export type RegraOcorrencia = {
  inicio_em: string | null;
  hora_base: string | null; // "HH:MM" ou "HH:MM:SS"
  recorrencia: 'nenhuma' | 'diaria' | 'semanal' | 'mensal';
  dias_semana: number[] | null; // 0=domingo … 6=sábado
  dia_mes: number | null;       // 1..31
};

function partesSP(instante: Date) {
  const s = new Date(instante.getTime() + SP_OFFSET_MIN * 60_000);
  return {
    ano: s.getUTCFullYear(), mes: s.getUTCMonth() + 1, dia: s.getUTCDate(),
    hora: s.getUTCHours(), minuto: s.getUTCMinutes(), diaSemana: s.getUTCDay(),
  };
}

function instanteSP(ano: number, mes: number, dia: number, hora: number, minuto: number): Date {
  return new Date(Date.UTC(ano, mes - 1, dia, hora, minuto) - SP_OFFSET_MIN * 60_000);
}

export function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

function parseHoraBase(hb: string | null): { hora: number; minuto: number } | null {
  if (!hb) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hb);
  if (!m) return null;
  const hora = +m[1];
  const minuto = +m[2];
  if (hora > 23 || minuto > 59) return null;
  return { hora, minuto };
}

export function proximaOcorrencia(regra: RegraOcorrencia, agora: Date): Date | null {
  if (regra.recorrencia === 'nenhuma') {
    if (!regra.inicio_em) return null;
    const inicio = new Date(regra.inicio_em);
    return inicio.getTime() >= agora.getTime() ? inicio : null;
  }

  const base = parseHoraBase(regra.hora_base);
  if (!base) return null;
  const hoje = partesSP(agora);

  if (regra.recorrencia === 'diaria') {
    const cand = (off: number) =>
      new Date(instanteSP(hoje.ano, hoje.mes, hoje.dia, base.hora, base.minuto).getTime() + off * 86_400_000);
    const hojeCand = cand(0);
    return hojeCand.getTime() >= agora.getTime() ? hojeCand : cand(1);
  }

  if (regra.recorrencia === 'semanal') {
    const dias = regra.dias_semana ?? [];
    if (dias.length === 0) return null;
    for (let off = 0; off <= 7; off++) {
      const cand = new Date(instanteSP(hoje.ano, hoje.mes, hoje.dia, base.hora, base.minuto).getTime() + off * 86_400_000);
      if (dias.includes(partesSP(cand).diaSemana) && cand.getTime() >= agora.getTime()) return cand;
    }
    return null;
  }

  const diaMes = regra.dia_mes;
  if (!diaMes || diaMes < 1 || diaMes > 31) return null;
  const noMes = (ano: number, mes: number) =>
    instanteSP(ano, mes, Math.min(diaMes, ultimoDiaDoMes(ano, mes)), base.hora, base.minuto);

  const desteMes = noMes(hoje.ano, hoje.mes);
  if (desteMes.getTime() >= agora.getTime()) return desteMes;
  const proxMes = hoje.mes === 12 ? 1 : hoje.mes + 1;
  const proxAno = hoje.mes === 12 ? hoje.ano + 1 : hoje.ano;
  return noMes(proxAno, proxMes);
}

const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** Rótulo legível da regra. String vazia para compromisso único. */
export function descreverRegra(regra: RegraOcorrencia): string {
  const hh = (regra.hora_base ?? '').slice(0, 5);
  switch (regra.recorrencia) {
    case 'diaria': return `todo dia às ${hh}`;
    case 'semanal': return `${(regra.dias_semana ?? []).map((d) => DIAS_CURTOS[d]).join('/')} às ${hh}`;
    case 'mensal': return `todo dia ${regra.dia_mes} às ${hh}`;
    default: return '';
  }
}
