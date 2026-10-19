// Datas e horas para a tela, no fuso escolhido pelo lead (o dele ou o de Brasília).

import { FUSO_BRASILIA } from './tempo'

const formatadores = new Map<string, Intl.DateTimeFormat>()

function formatador(fuso: string, opcoes: Intl.DateTimeFormatOptions, idioma = 'pt-BR'): Intl.DateTimeFormat {
  const chave = `${idioma}|${fuso}|${JSON.stringify(opcoes)}`
  let f = formatadores.get(chave)
  if (!f) {
    f = new Intl.DateTimeFormat(idioma, { timeZone: fuso, ...opcoes })
    formatadores.set(chave, f)
  }
  return f
}

/** O dia ('AAAA-MM-DD') em que o instante cai, no fuso. */
export function dataNoFuso(instante: string, fuso: string): string {
  const partes = formatador(
    fuso,
    { year: 'numeric', month: '2-digit', day: '2-digit' },
    'en-US',
  ).formatToParts(new Date(instante))
  const parte = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((p) => p.type === tipo)?.value ?? ''
  return `${parte('year')}-${parte('month')}-${parte('day')}`
}

/** '09:30' */
export const horaNoFuso = (instante: string, fuso: string): string =>
  formatador(fuso, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(instante))

/** 'terça-feira, 21 de outubro' */
export const dataPorExtenso = (instante: string, fuso: string): string =>
  formatador(fuso, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(instante))

/** 'terça-feira, 21 de outubro' para um dia de calendário ('AAAA-MM-DD'). */
export const diaPorExtenso = (data: string): string => dataPorExtenso(`${data}T12:00:00Z`, 'UTC')

/** 'outubro de 2026' para 'AAAA-MM'. */
export const nomeDoMes = (mes: string): string =>
  formatador('UTC', { month: 'long', year: 'numeric' }).format(new Date(`${mes}-01T12:00:00Z`))

/** 'GMT-3' */
export function deslocamento(fuso: string, quando: Date = new Date()): string {
  const partes = formatador(fuso, { timeZoneName: 'shortOffset' }, 'en-US').formatToParts(quando)
  return partes.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT'
}

/** 'Horário de Brasília' ou 'Lisbon (GMT+1)'. */
export function nomeDoFuso(fuso: string): string {
  if (fuso === FUSO_BRASILIA) return 'Horário de Brasília'
  const cidade = fuso.split('/').pop()?.replace(/_/g, ' ') ?? fuso
  return `${cidade} (${deslocamento(fuso)})`
}

/** '09:30 – 10:00' */
export const faixaDeHorario = (inicio: string, fim: string, fuso: string): string =>
  `${horaNoFuso(inicio, fuso)} – ${horaNoFuso(fim, fuso)}`
