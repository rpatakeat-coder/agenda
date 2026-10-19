// Feriados nacionais — fixos (Lei 662/1949 e alterações, Consciência Negra desde 2024) e móveis
// (Sexta-feira Santa e Carnaval, que o time comercial não trabalha). Feriados locais e outros
// pontos facultativos (ex.: Corpus Christi) entram por AGENDA_FERIADOS_EXTRAS.

import { somarDias } from './tempo'

const FIXOS: ReadonlyArray<readonly [string, string]> = [
  ['01-01', 'Confraternização Universal'],
  ['04-21', 'Tiradentes'],
  ['05-01', 'Dia do Trabalho'],
  ['09-07', 'Independência do Brasil'],
  ['10-12', 'Nossa Senhora Aparecida'],
  ['11-02', 'Finados'],
  ['11-15', 'Proclamação da República'],
  ['11-20', 'Dia da Consciência Negra'],
  ['12-25', 'Natal'],
]

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher), em 'AAAA-MM-DD'. */
export function pascoa(ano: number): string {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

const cache = new Map<number, ReadonlyMap<string, string>>()

/** Feriados nacionais do ano: data → nome. */
export function feriadosNacionais(ano: number): ReadonlyMap<string, string> {
  const pronto = cache.get(ano)
  if (pronto) return pronto
  const p = pascoa(ano)
  const feriados = new Map<string, string>(FIXOS.map(([md, nome]) => [`${ano}-${md}`, nome]))
  feriados.set(somarDias(p, -48), 'Carnaval')
  feriados.set(somarDias(p, -47), 'Carnaval')
  feriados.set(somarDias(p, -2), 'Sexta-feira Santa')
  cache.set(ano, feriados)
  return feriados
}

export function ehFeriado(data: string, extras: ReadonlySet<string> = new Set()): boolean {
  return extras.has(data) || feriadosNacionais(Number(data.slice(0, 4))).has(data)
}
