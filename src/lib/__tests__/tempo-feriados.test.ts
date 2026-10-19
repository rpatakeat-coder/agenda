import { describe, expect, it } from 'vitest'
import { ehFeriado, feriadosNacionais, pascoa } from '../feriados'
import { dataNoFuso, horaNoFuso, nomeDoFuso } from '../formatacao'
import {
  dataBrasilia,
  dataValida,
  diaDaSemana,
  horaBrasilia,
  instanteBrasilia,
  isoBrasilia,
  paraHorario,
  paraMinutos,
  somarDias,
} from '../tempo'

describe('tempo em Brasília', () => {
  it('converte data + hora de Brasília em instante e volta', () => {
    const ms = instanteBrasilia('2026-10-21', paraMinutos('09:30'))
    expect(new Date(ms).toISOString()).toBe('2026-10-21T12:30:00.000Z')
    expect(isoBrasilia(ms)).toBe('2026-10-21T09:30:00-03:00')
    expect(dataBrasilia(ms)).toBe('2026-10-21')
    expect(horaBrasilia(ms)).toBe('09:30')
  })

  it('23h em Brasília ainda é o mesmo dia (já é amanhã em UTC)', () => {
    const ms = instanteBrasilia('2026-10-21', paraMinutos('23:00'))
    expect(dataBrasilia(ms)).toBe('2026-10-21')
  })

  it('valida datas', () => {
    expect(dataValida('2026-02-28')).toBe(true)
    expect(dataValida('2026-02-29')).toBe(false)
    expect(dataValida('2028-02-29')).toBe(true)
    expect(dataValida('21/10/2026')).toBe(false)
  })

  it('soma dias atravessando mês e ano', () => {
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('dia da semana e conversão de horário', () => {
    expect(diaDaSemana('2026-10-19')).toBe(1)
    expect(paraHorario(paraMinutos('07:05'))).toBe('07:05')
  })
})

describe('fuso de quem vê', () => {
  const inicio = '2026-10-21T21:30:00-03:00'

  it('agrupa pelo dia no fuso do lead', () => {
    expect(dataNoFuso(inicio, 'America/Sao_Paulo')).toBe('2026-10-21')
    expect(dataNoFuso(inicio, 'Europe/Lisbon')).toBe('2026-10-22')
  })

  it('mostra a hora no fuso do lead', () => {
    expect(horaNoFuso(inicio, 'America/Sao_Paulo')).toBe('21:30')
    expect(horaNoFuso(inicio, 'America/Manaus')).toBe('20:30')
  })

  it('nomeia o fuso', () => {
    expect(nomeDoFuso('America/Sao_Paulo')).toBe('Horário de Brasília')
    expect(nomeDoFuso('America/Manaus')).toBe('Manaus (GMT-4)')
  })
})

describe('feriados', () => {
  it('calcula a Páscoa', () => {
    expect(pascoa(2026)).toBe('2026-04-05')
    expect(pascoa(2027)).toBe('2027-03-28')
  })

  it('inclui fixos e móveis', () => {
    const f = feriadosNacionais(2026)
    expect(f.get('2026-11-20')).toBe('Dia da Consciência Negra')
    expect(f.get('2026-02-16')).toBe('Carnaval')
    expect(f.get('2026-02-17')).toBe('Carnaval')
    expect(f.get('2026-04-03')).toBe('Sexta-feira Santa')
  })

  it('aceita feriados extras', () => {
    expect(ehFeriado('2026-06-04')).toBe(false)
    expect(ehFeriado('2026-06-04', new Set(['2026-06-04']))).toBe(true)
  })
})
