// Tempo em Brasília. Mesma convenção do Takeat OS (api/_lib/agendaDoDia.js): UTC−3 fixo — o
// Brasil não tem horário de verão desde 2019 — e instantes em ISO com o fuso explícito (-03:00).

export const FUSO_BRASILIA = 'America/Sao_Paulo'
export const MIN_MS = 60_000
export const DIA_MS = 24 * 60 * MIN_MS
const BRT_MS = 3 * 60 * MIN_MS

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/
const RE_HORARIO = /^([01]\d|2[0-3]):[0-5]\d$/

/** 'AAAA-MM-DD' existe no calendário? */
export function dataValida(data: string): boolean {
  if (!RE_DATA.test(data)) return false
  const [a, m, d] = data.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d)).toISOString().slice(0, 10) === data
}

export const horarioValido = (hhmm: string): boolean => RE_HORARIO.test(hhmm)

/** 'HH:MM' → minutos desde a meia-noite. */
export function paraMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Minutos desde a meia-noite → 'HH:MM'. */
export const paraHorario = (minutos: number): string =>
  `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`

/** O instante de 'AAAA-MM-DD' + minutos do dia, em Brasília. */
export function instanteBrasilia(data: string, minutos = 0): number {
  const [a, m, d] = data.split('-').map(Number)
  return Date.UTC(a, m - 1, d) + BRT_MS + minutos * MIN_MS
}

/** Instante → '2026-10-06T14:30:00-03:00'. */
export const isoBrasilia = (ms: number): string => `${new Date(ms - BRT_MS).toISOString().slice(0, 19)}-03:00`
/** Instante → 'AAAA-MM-DD' em Brasília. */
export const dataBrasilia = (ms: number): string => new Date(ms - BRT_MS).toISOString().slice(0, 10)
/** Instante → 'HH:MM' em Brasília. */
export const horaBrasilia = (ms: number): string => new Date(ms - BRT_MS).toISOString().slice(11, 16)

/** 0 = domingo … 6 = sábado. */
export const diaDaSemana = (data: string): number => new Date(`${data}T12:00:00Z`).getUTCDay()

export function somarDias(data: string, dias: number): string {
  const [a, m, d] = data.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10)
}
