// America/Sao_Paulo. Entrada usa offset fixo -03:00 (Brasil sem DST desde 2019);
// exibição usa Intl (o browser tem tz data completa).

export function spParaInstante(data: string, hora: string): string {
  // data=YYYY-MM-DD, hora=HH:MM → instante UTC
  return new Date(`${data}T${hora}:00-03:00`).toISOString();
}

const FMT = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  weekday: 'short', day: '2-digit', month: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
});

export function formatarInstanteSP(iso: string): string {
  // ex: "sex., 11/07, 15:00" → normaliza para "sex 11/07 15:00"
  return FMT.format(new Date(iso)).replace(/\.,?/g, '').replace(/,/g, '').replace(/\s+/g, ' ').trim();
}

export function partesInstanteSP(iso: string): { data: string; hora: string } {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return { data: `${get('year')}-${get('month')}-${get('day')}`, hora: `${get('hour')}:${get('minute')}` };
}
