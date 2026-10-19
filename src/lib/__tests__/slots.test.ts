import { describe, expect, it } from 'vitest'
import {
  calcularSlots,
  diasDaJanela,
  ordenarParaRoleta,
  type RegrasAgenda,
  type VendedorAgenda,
} from '../slots'
import { instanteBrasilia, paraMinutos } from '../tempo'

const regras: RegrasAgenda = {
  expediente: { inicio: paraMinutos('09:00'), fim: paraMinutos('18:00') },
  almoco: { inicio: paraMinutos('12:00'), fim: paraMinutos('13:00') },
  diasDaSemana: [1, 2, 3, 4, 5],
  duracaoMin: 30,
  passoMin: 30,
  bufferMin: 10,
  antecedenciaMin: 120,
  janelaDiasUteis: 14,
  feriadosExtras: new Set(),
}

// Quarta-feira, 21/10/2026. "Agora" = dia anterior, para a antecedência não interferir.
const DIA = '2026-10-21'
const ONTEM = instanteBrasilia('2026-10-20', paraMinutos('09:00'))

const ocupado = (de: string, ate: string) => ({
  inicioMs: instanteBrasilia(DIA, paraMinutos(de)),
  fimMs: instanteBrasilia(DIA, paraMinutos(ate)),
})

const vendedor = (nome: string, extra: Partial<VendedorAgenda> = {}): VendedorAgenda => ({
  id: nome,
  nome,
  email: `${nome.toLowerCase()}@takeat.app`,
  compromissosNoDia: 0,
  ocupado: [],
  ...extra,
})

const horarios = (args: Parameters<typeof calcularSlots>[0]) => calcularSlots(args).map((s) => s.horario)

describe('calcularSlots', () => {
  it('oferece o expediente inteiro, sem o almoço', () => {
    const r = horarios({ data: DIA, vendedores: [vendedor('Ana')], regras, agoraMs: ONTEM })
    expect(r).toEqual([
      '09:00',
      '09:30',
      '10:00',
      '10:30',
      '11:00',
      '11:30',
      '13:00',
      '13:30',
      '14:00',
      '14:30',
      '15:00',
      '15:30',
      '16:00',
      '16:30',
      '17:00',
      '17:30',
    ])
  })

  it('não oferece fim de semana, feriado nacional nem feriado extra', () => {
    const v = [vendedor('Ana')]
    expect(calcularSlots({ data: '2026-10-24', vendedores: v, regras, agoraMs: ONTEM })).toEqual([])
    expect(calcularSlots({ data: '2026-11-02', vendedores: v, regras, agoraMs: ONTEM })).toEqual([])
    const comExtra = { ...regras, feriadosExtras: new Set([DIA]) }
    expect(calcularSlots({ data: DIA, vendedores: v, regras: comExtra, agoraMs: ONTEM })).toEqual([])
  })

  it('respeita o buffer antes e depois de um compromisso', () => {
    const r = horarios({
      data: DIA,
      vendedores: [vendedor('Ana', { ocupado: [ocupado('10:00', '11:00')] })],
      regras,
      agoraMs: ONTEM,
    })
    // 09:30–10:00 encosta (falta folga); 11:00 começa sem os 10 min depois da reunião.
    expect(r).not.toContain('09:30')
    expect(r).not.toContain('10:00')
    expect(r).not.toContain('10:30')
    expect(r).not.toContain('11:00')
    expect(r).toContain('09:00')
    expect(r).toContain('11:30')
  })

  it('sem buffer, horário encostado na reunião vale', () => {
    const r = horarios({
      data: DIA,
      vendedores: [vendedor('Ana', { ocupado: [ocupado('10:00', '11:00')] })],
      regras: { ...regras, bufferMin: 0 },
      agoraMs: ONTEM,
    })
    expect(r).toContain('09:30')
    expect(r).toContain('11:00')
    expect(r).not.toContain('10:30')
  })

  it('aplica a antecedência mínima a partir de agora', () => {
    const agora = instanteBrasilia(DIA, paraMinutos('10:05'))
    const r = horarios({ data: DIA, vendedores: [vendedor('Ana')], regras, agoraMs: agora })
    // agora + 2 h = 12:05; 12:30 cai no almoço → o primeiro é 13:00.
    expect(r[0]).toBe('13:00')
  })

  it('o horário aparece se QUALQUER vendedor estiver livre, na ordem da roleta', () => {
    const ana = vendedor('Ana', { compromissosNoDia: 3, ocupado: [ocupado('09:00', '10:00')] })
    const bruno = vendedor('Bruno', { compromissosNoDia: 1 })
    const carla = vendedor('Carla', { compromissosNoDia: 1 })
    const slots = calcularSlots({ data: DIA, vendedores: [ana, carla, bruno], regras, agoraMs: ONTEM })
    const nove = slots.find((s) => s.horario === '09:00')
    expect(nove?.vendedores.map((v) => v.nome)).toEqual(['Bruno', 'Carla'])
    const onze = slots.find((s) => s.horario === '11:00')
    expect(onze?.vendedores.map((v) => v.nome)).toEqual(['Bruno', 'Carla', 'Ana'])
  })

  it('ninguém livre → sem horário; sem vendedor → sem horário', () => {
    const cheia = vendedor('Ana', { ocupado: [ocupado('00:00', '23:59')] })
    expect(calcularSlots({ data: DIA, vendedores: [cheia], regras, agoraMs: ONTEM })).toEqual([])
    expect(calcularSlots({ data: DIA, vendedores: [], regras, agoraMs: ONTEM })).toEqual([])
  })

  it('devolve instantes em Brasília', () => {
    const [primeiro] = calcularSlots({ data: DIA, vendedores: [vendedor('Ana')], regras, agoraMs: ONTEM })
    expect(new Date(primeiro.inicioMs).toISOString()).toBe('2026-10-21T12:00:00.000Z')
    expect(primeiro.fimMs - primeiro.inicioMs).toBe(30 * 60_000)
  })
})

describe('diasDaJanela', () => {
  it('conta só dias úteis, a partir de hoje', () => {
    const dias = diasDaJanela('2026-10-16', regras) // sexta
    expect(dias).toHaveLength(14)
    expect(dias.slice(0, 3)).toEqual(['2026-10-16', '2026-10-19', '2026-10-20'])
  })

  it('pula feriados', () => {
    const dias = diasDaJanela('2026-11-02', regras) // Finados (segunda)
    expect(dias[0]).toBe('2026-11-03')
    expect(dias).not.toContain('2026-11-20') // Consciência Negra
  })
})

describe('ordenarParaRoleta', () => {
  it('menos compromissos primeiro, empate pelo nome', () => {
    const r = ordenarParaRoleta([
      vendedor('Zé', { compromissosNoDia: 0 }),
      vendedor('Ana', { compromissosNoDia: 2 }),
      vendedor('Bia', { compromissosNoDia: 0 }),
    ])
    expect(r.map((v) => v.nome)).toEqual(['Bia', 'Zé', 'Ana'])
  })
})
