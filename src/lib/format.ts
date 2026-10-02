// Datas e horas no fuso da cidade. O fuso vem da sessão do cidadão
// (POST/GET /citizen/session → time_zone, api#27): citizenApi o instala a cada
// resposta de sessão. Até lá, o horário de Brasília.

export const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

let cityTz = DEFAULT_TIME_ZONE;

export function setCityTimeZone(tz: string | null | undefined): void {
  cityTz = tz || DEFAULT_TIME_ZONE;
}

export function cityTimeZone(): string {
  return cityTz;
}

// Intl.DateTimeFormat é caro de montar: um por (opções, fuso).
const cache = new Map<string, Intl.DateTimeFormat>();
export function cityDateFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${cityTz}|${JSON.stringify(options)}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: cityTz });
    cache.set(key, f);
  }
  return f;
}

function format(iso: string | null | undefined, options: Intl.DateTimeFormatOptions): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return cityDateFormat(options).format(d);
}

export function fmtDateTime(iso: string | null | undefined): string {
  return format(iso, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Só a data (caixa de avisos), no fuso da cidade.
export function fmtDate(iso: string | null | undefined): string {
  return format(iso, { day: "2-digit", month: "2-digit", year: "numeric" });
}
