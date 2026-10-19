import { describe, expect, it } from 'vitest'
import { type AgendaDoDia, casaVendedor, resolverVendedor, slugDoNome, vendedoresElegiveis } from '../agenda'

const DIA = '2026-10-21'

const pessoa = (id: string, nome: string, situacao = 'livre', compromissos = 0) => ({
  id,
  nome,
  email: `${id}@takeat.app`,
  hubspot_owner_id: null,
  situacao,
  compromissos_no_dia: compromissos,
})

const evento = (
  dono: string,
  inicio: string,
  fim: string,
  extra: Partial<AgendaDoDia['eventos'][number]> = {},
) => ({
  dono: { id: dono },
  titulo: 'Reunião',
  inicio: `${DIA}T${inicio}:00-03:00`,
  fim: `${DIA}T${fim}:00-03:00`,
  dia_inteiro: false,
  ocupa_agenda: true,
  ...extra,
})

const agenda: AgendaDoDia = {
  ok: true,
  data: DIA,
  pessoas: [
    pessoa('caio', 'Caio Caiado', 'ocupado', 1),
    pessoa('sergio', 'Sérgio Lima'),
    pessoa('gustavo', 'Gustavo de Freitas', 'sem_agenda'),
    pessoa('israel', 'Israel Souza', 'agenda_desatualizada'),
    pessoa('maria', 'Maria Eduarda', 'agenda_com_erro'),
  ],
  eventos: [
    evento('caio', '14:00', '15:00'),
    evento('caio', '16:00', '17:00', { ocupa_agenda: false }),
    evento('sergio', '00:00', '00:00', { dia_inteiro: true, ocupa_agenda: false }),
  ],
}

describe('vendedoresElegiveis', () => {
  it('só entra quem tem agenda confiável', () => {
    const r = vendedoresElegiveis(agenda, { permitidos: [] })
    expect(r.map((v) => v.id)).toEqual(['caio', 'sergio'])
  })

  it('só evento que ocupa a agenda bloqueia', () => {
    const [caio, sergio] = vendedoresElegiveis(agenda, { permitidos: [] })
    expect(caio.ocupado).toHaveLength(1)
    expect(caio.compromissosNoDia).toBe(1)
    expect(sergio.ocupado).toHaveLength(0)
  })

  it('evento de dia inteiro que ocupa bloqueia o dia todo', () => {
    const comFerias: AgendaDoDia = {
      ...agenda,
      eventos: [evento('sergio', '00:00', '00:00', { dia_inteiro: true, ocupa_agenda: true })],
    }
    const sergio = vendedoresElegiveis(comFerias, { permitidos: [] }).find((v) => v.id === 'sergio')
    const [dia] = sergio?.ocupado ?? []
    expect(dia.fimMs - dia.inicioMs).toBe(24 * 3_600_000)
  })

  it('filtra pela lista de permitidos (roleta) e pelo link direcionado', () => {
    expect(vendedoresElegiveis(agenda, { permitidos: ['sergio@takeat.app'] }).map((v) => v.id)).toEqual([
      'sergio',
    ])
    expect(vendedoresElegiveis(agenda, { permitidos: [], vendedor: 'caio' }).map((v) => v.id)).toEqual([
      'caio',
    ])
  })

  it('na remarcação, a própria reunião não ocupa', () => {
    const inicioMs = Date.parse(`${DIA}T14:00:00-03:00`)
    const fimMs = Date.parse(`${DIA}T15:00:00-03:00`)
    const [caio] = vendedoresElegiveis(agenda, {
      permitidos: [],
      vendedor: 'caio@takeat.app',
      ignorar: { email: 'CAIO@takeat.app', inicioMs, fimMs },
    })
    expect(caio.ocupado).toEqual([])
  })
})

describe('casaVendedor / resolverVendedor', () => {
  const sergio = { nome: 'Sérgio Lima', email: 'sergio@takeat.app' }

  it('casa por slug, sem acento, por começo de nome e por e-mail', () => {
    expect(slugDoNome('Sérgio  Lima')).toBe('sergio-lima')
    expect(casaVendedor(sergio, 'sergio-lima')).toBe(true)
    expect(casaVendedor(sergio, 'Sergio')).toBe(true)
    expect(casaVendedor(sergio, 'SERGIO@takeat.app')).toBe(true)
    expect(casaVendedor(sergio, 'serg')).toBe(false)
    expect(casaVendedor(sergio, 'lima')).toBe(false)
    expect(casaVendedor(sergio, '')).toBe(false)
  })

  it('link direcionado precisa achar uma pessoa só', () => {
    const pessoas = [pessoa('a', 'Lucas Segatto'), pessoa('b', 'Lucas Moura')]
    expect(resolverVendedor(pessoas, 'lucas')).toEqual({ erro: 'vendedor_ambiguo' })
    expect(resolverVendedor(pessoas, 'joao')).toEqual({ erro: 'vendedor_nao_encontrado' })
    expect(resolverVendedor(pessoas, 'lucas-moura')).toEqual({ pessoa: pessoas[1] })
  })
})
