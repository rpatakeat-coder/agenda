import { describe, expect, it } from 'vitest'
import { conteudoIcs, linkGoogleAgenda } from '../calendario-externo'
import { descricaoDoConvite, tituloDoConvite } from '../convite'
import { agendamentoSchema, dadosLeadSchema } from '../schemas'
import { mascararTelefone, normalizarTelefone, telefoneValido } from '../telefone'

describe('telefone', () => {
  it('normaliza o jeito brasileiro de digitar para E.164', () => {
    expect(normalizarTelefone('(11) 98765-4321')).toBe('+5511987654321')
    expect(normalizarTelefone('11987654321')).toBe('+5511987654321')
    expect(normalizarTelefone('+55 11 98765-4321')).toBe('+5511987654321')
    expect(normalizarTelefone('5511987654321')).toBe('+5511987654321')
    expect(normalizarTelefone('(31) 3333-4444')).toBe('+553133334444')
    expect(normalizarTelefone('+351 912 345 678')).toBe('+351912345678')
    expect(normalizarTelefone('123')).toBe('')
  })

  it('valida DDD e celular brasileiros', () => {
    expect(telefoneValido('+5511987654321')).toBe(true)
    expect(telefoneValido('+553133334444')).toBe(true)
    expect(telefoneValido('+5501987654321')).toBe(false)
    expect(telefoneValido('+5511887654321')).toBe(false)
    expect(telefoneValido('+351912345678')).toBe(true)
  })

  it('mascara enquanto digita', () => {
    expect(mascararTelefone('1198765')).toBe('(11) 9876-5')
    expect(mascararTelefone('11987654321')).toBe('(11) 98765-4321')
    expect(mascararTelefone('+351 912')).toBe('+351 912')
  })
})

describe('schemas', () => {
  const valido = {
    nome: '  Teresa Lima ',
    email: ' Teresa@Padaria.com ',
    telefone: '(11) 98765-4321',
    empresa: 'Padaria Central',
  }

  it('limpa e normaliza os dados do lead', () => {
    expect(dadosLeadSchema.parse(valido)).toEqual({
      nome: 'Teresa Lima',
      email: 'teresa@padaria.com',
      telefone: '+5511987654321',
      empresa: 'Padaria Central',
    })
  })

  it('aponta o campo inválido', () => {
    const r = dadosLeadSchema.safeParse({ ...valido, email: 'teresa@', telefone: '9999' })
    expect(r.success).toBe(false)
    const campos = r.error?.issues.map((i) => i.path[0])
    expect(campos).toContain('email')
    expect(campos).toContain('telefone')
  })

  it('exige horário com fuso', () => {
    expect(agendamentoSchema.safeParse({ ...valido, inicio: '2026-10-21T09:30:00-03:00' }).success).toBe(true)
    expect(agendamentoSchema.safeParse({ ...valido, inicio: '2026-10-21 09:30' }).success).toBe(false)
  })
})

describe('convite', () => {
  const lead = {
    nome: 'Teresa <b>Lima</b>',
    email: 't@p.com',
    telefone: '+5511987654321',
    empresa: 'Padaria Central',
  }

  it('título com o restaurante', () => {
    expect(tituloDoConvite('Demo Takeat', lead)).toBe('Demo Takeat — Padaria Central')
  })

  it('descrição sem marcação e com o link de gestão quando houver', () => {
    const sem = descricaoDoConvite(lead, { vendedor: 'Lucas Segatto' })
    expect(sem).not.toContain('<')
    expect(sem).toContain('Olá, Teresa!')
    expect(sem).not.toContain('remarcar')
    expect(sem).not.toContain('Faturamento')
    const com = descricaoDoConvite(lead, {
      vendedor: 'Lucas',
      linkDeGestao: 'https://agenda.takeat.app/reuniao/x',
      faturamento: 'Entre 20 e 50 mil',
      mesas: 'Até 10 mesas',
    })
    expect(com).toContain('Precisa remarcar ou cancelar? https://agenda.takeat.app/reuniao/x')
    expect(com).toContain('Faturamento mensal: Entre 20 e 50 mil')
    expect(com).toContain('Mesas: Até 10 mesas')
    // O segmento (HIGH/MID/LOW) é interno: não vai para o convite, que o lead também lê.
    expect(com).not.toMatch(/high|mid|low|segmento/i)
  })
})

describe('adicionar à agenda', () => {
  const evento = {
    uid: 'abc@google.com',
    titulo: 'Demo Takeat — Padaria, Central; Ltda',
    inicio: '2026-10-21T09:30:00-03:00',
    fim: '2026-10-21T10:00:00-03:00',
    descricao: `Linha 1\nLinha 2 ${'é'.repeat(80)}`,
    local: 'https://meet.google.com/abc-defg-hij',
  }

  it('link do Google Agenda em UTC', () => {
    const url = new URL(linkGoogleAgenda(evento))
    expect(url.searchParams.get('dates')).toBe('20261021T123000Z/20261021T130000Z')
    expect(url.searchParams.get('location')).toBe(evento.local)
  })

  it('.ics com CRLF, escape e linhas de até 75 bytes', () => {
    const ics = conteudoIcs(evento, Date.parse('2026-10-19T12:00:00Z'))
    expect(ics).toContain('DTSTART:20261021T123000Z\r\n')
    expect(ics).toContain('SUMMARY:Demo Takeat — Padaria\\, Central\\; Ltda')
    for (const linha of ics.split('\r\n'))
      expect(new TextEncoder().encode(linha).length).toBeLessThanOrEqual(75)
  })
})
