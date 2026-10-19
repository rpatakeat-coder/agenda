import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { candidatosDaSessao, posicaoNaRoleta } from '../roteamento'
import { formularioDoSiteSchema } from '../schemas'
import { abrir, selar } from '../servidor/selo'

const SEGREDO = 's'.repeat(32)

describe('selo', () => {
  const schema = z.object({ a: z.number() })

  it('ida e volta na mesma finalidade', () => {
    expect(abrir(selar({ a: 1 }, SEGREDO, 'sessao'), SEGREDO, schema, 'sessao')).toEqual({ a: 1 })
  })

  it('código de sessão não abre como link de reunião, e vice-versa', () => {
    expect(abrir(selar({ a: 1 }, SEGREDO, 'sessao'), SEGREDO, schema)).toBeNull()
    expect(abrir(selar({ a: 1 }, SEGREDO), SEGREDO, schema, 'sessao')).toBeNull()
  })
})

describe('posicaoNaRoleta', () => {
  it('o mesmo lead cai sempre no mesmo vendedor (sem diferenciar maiúscula)', () => {
    expect(posicaoNaRoleta('Rita@Cafe.com', 6)).toBe(posicaoNaRoleta('rita@cafe.com', 6))
    expect(posicaoNaRoleta('rita@cafe.com', 6)).toBe(posicaoNaRoleta(' rita@cafe.com ', 6))
  })

  it('leads diferentes se espalham por igual entre os vendedores', () => {
    const contagem = Array.from({ length: 6 }, () => 0)
    for (let i = 0; i < 6000; i++) contagem[posicaoNaRoleta(`lead${i}@restaurante.com.br`, 6)]++
    // 1000 de média para cada; nenhum vendedor fica com menos de 850 nem mais de 1150.
    for (const n of contagem) expect(n).toBeGreaterThan(850)
    for (const n of contagem) expect(n).toBeLessThan(1150)
  })

  it('total zero não quebra', () => {
    expect(posicaoNaRoleta('x@y.com', 0)).toBe(0)
  })
})

describe('candidatosDaSessao', () => {
  const v = (email: string) => ({ email })
  const slot = (horario: string, ...vendedores: string[]) => ({ horario, vendedores: vendedores.map(v) })

  it('quem tem horário nos 2 primeiros dias com horário, com o primeiro horário de cada, em ordem de e-mail', () => {
    const dias = [
      { data: '2026-10-20', slots: [] },
      { data: '2026-10-21', slots: [slot('09:00', 'bia@t'), slot('10:00', 'ana@t', 'bia@t')] },
      { data: '2026-10-22', slots: [slot('09:00', 'caio@t')] },
      { data: '2026-10-23', slots: [slot('09:00', 'duda@t')] },
    ]
    const r = candidatosDaSessao(dias)
    expect(r.map((c) => [c.vendedor.email, c.data, c.slot.horario])).toEqual([
      ['ana@t', '2026-10-21', '10:00'],
      ['bia@t', '2026-10-21', '09:00'],
      ['caio@t', '2026-10-22', '09:00'],
    ])
  })

  it('sem horário nenhum: ninguém (a sessão vai para a tela de WhatsApp)', () => {
    expect(candidatosDaSessao([{ data: '2026-10-20', slots: [] }])).toEqual([])
  })
})

describe('formulário do site (POST /api/sessoes)', () => {
  it('lê os nomes do HubSpot e ignora o resto do formulário', () => {
    const r = formularioDoSiteSchema.parse({
      firstname: 'Rita Alves',
      email: 'rita@cafe.com',
      phone: '(11) 95555-4444',
      nome_do_restaurante: 'Café da Rita',
      faturamento_contato: 'Entre 20 e 50 mil',
      quantidade_mesas: 'Até 10 mesas',
      tipo_operacao: 'Delivery',
      principal_desafio: 'Atendimento',
      utm_source: 'google',
      page_uri: 'https://takeat.app/#contato',
    })
    expect(r).toEqual({
      lead: {
        nome: 'Rita Alves',
        email: 'rita@cafe.com',
        telefone: '(11) 95555-4444',
        empresa: 'Café da Rita',
      },
      faturamento: 'Entre 20 e 50 mil',
      mesas: 'Até 10 mesas',
      origem: expect.objectContaining({
        canal: 'site_formulario',
        utm_source: 'google',
        pagina: 'https://takeat.app/#contato',
      }),
    })
  })

  it('UTM longa é cortada, não derruba a sessão', () => {
    const r = formularioDoSiteSchema.parse({ email: 'a@b.com', utm_campaign: 'x'.repeat(450) })
    expect(r.origem.utm_campaign).toHaveLength(200)
  })
})
