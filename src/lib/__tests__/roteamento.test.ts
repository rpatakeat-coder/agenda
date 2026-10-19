import { describe, expect, it } from 'vitest'
import { SEGMENTO_POR_RESPOSTA, VENDEDORES_POR_SEGMENTO } from '@/config/roteamento'
import {
  FAIXAS_DE_MESAS,
  type FaixaFaturamento,
  type FaixaMesas,
  faixaDeMesas,
  faixaDoFaturamento,
  faixasQueDependemDasMesas,
  permitidosParaLead,
  roteamentoAtivo,
  segmentoDoLead,
  type VendedoresPorSegmento,
  valorEmReais,
} from '../roteamento'

const ROLETA = ['todo@takeat.app', 'o@takeat.app', 'time@takeat.app']

/** Quem recebe o lead com a configuração de verdade (src/config/roteamento.ts). */
const quemRecebe = (faixa: FaixaFaturamento | null, mesas: FaixaMesas | null = null) =>
  permitidosParaLead({
    regra: SEGMENTO_POR_RESPOSTA,
    vendedores: VENDEDORES_POR_SEGMENTO,
    roleta: ROLETA,
    faixa,
    mesas,
  })

const HIGH = [
  'luizasodre.takeat@gmail.com',
  'marcelo.takeat@gmail.com',
  'thayrone.takeat@gmail.com',
  'caiocaiado.takeat@gmail.com',
  'andrerocon.takeat@gmail.com',
  'vitorquintela.takeat@gmail.com',
]
const LOW = [
  'rodrigoesteves.takeat@gmail.com',
  'isabelallaraujo.takeat@gmail.com',
  'amanda.takeat@gmail.com',
  'gustavofreitas.takeat@gmail.com',
  'mariacosmo.takeat@gmail.com',
]

describe('distribuição definida pelo comercial (19/10/2026)', () => {
  it('HIGH: acima de 100 mil → Luiza, Marcelo, Thayrone, Caio, André e Vitinho', () => {
    expect(quemRecebe('100k-200k')).toEqual(HIGH)
    expect(quemRecebe('acima-200k')).toEqual(HIGH)
    expect(quemRecebe('acima-200k', 'ate-10')).toEqual(HIGH) // mesas não mudam o HIGH
  })

  it('MID: entre 50 e 100 mil → todos', () => {
    expect(quemRecebe('50k-100k')).toBe(ROLETA)
    expect(quemRecebe('50k-100k', 'ate-10')).toBe(ROLETA)
  })

  it('até 50 mil com 10 mesas ou mais → MID (todos)', () => {
    for (const faixa of ['ate-20k', '20k-50k'] as const) {
      expect(quemRecebe(faixa, '10-30')).toBe(ROLETA)
      expect(quemRecebe(faixa, 'acima-30')).toBe(ROLETA)
    }
  })

  it('LOW: até 50 mil com até 10 mesas ou sem mesas → Rodrigo, Isabela, Amanda, Gustavo e Maria Eduarda', () => {
    for (const faixa of ['ate-20k', '20k-50k'] as const) {
      expect(quemRecebe(faixa, 'ate-10')).toEqual(LOW)
      expect(quemRecebe(faixa, 'sem-mesas')).toEqual(LOW)
    }
  })

  it('até 50 mil sem dizer as mesas: a página pergunta (não cai na roleta)', () => {
    expect(quemRecebe('ate-20k')).toBe('mesas_obrigatorio')
    expect(quemRecebe('20k-50k')).toBe('mesas_obrigatorio')
    expect(faixasQueDependemDasMesas(SEGMENTO_POR_RESPOSTA)).toEqual(['ate-20k', '20k-50k'])
  })

  it('sem faturamento: não tem agenda', () => {
    expect(quemRecebe(null)).toBe('faturamento_obrigatorio')
  })

  it('ninguém está em HIGH e LOW ao mesmo tempo; e-mails válidos', () => {
    expect(HIGH.filter((e) => LOW.includes(e))).toEqual([])
    for (const quem of Object.values(VENDEDORES_POR_SEGMENTO)) {
      if (quem === 'roleta') continue
      for (const email of quem) expect(email).toMatch(/^[a-z0-9.]+@[a-z0-9.]+\.[a-z]+$/)
    }
  })
})

describe('permitidosParaLead', () => {
  const tudoRoleta: VendedoresPorSegmento = { high: 'roleta', mid: 'roleta', low: 'roleta' }

  it('com tudo em roleta, o roteamento fica desligado e nada é exigido', () => {
    expect(roteamentoAtivo(tudoRoleta)).toBe(false)
    expect(roteamentoAtivo(VENDEDORES_POR_SEGMENTO)).toBe(true)
    const r = permitidosParaLead({
      regra: SEGMENTO_POR_RESPOSTA,
      vendedores: tudoRoleta,
      roleta: ROLETA,
      faixa: null,
      mesas: null,
    })
    expect(r).toBe(ROLETA)
  })

  it('transferência de reunião sem respostas (link direto) aceita a roleta', () => {
    const base = { regra: SEGMENTO_POR_RESPOSTA, vendedores: VENDEDORES_POR_SEGMENTO, roleta: ROLETA }
    expect(permitidosParaLead({ ...base, faixa: null, mesas: null, semResposta: 'roleta' })).toBe(ROLETA)
    expect(permitidosParaLead({ ...base, faixa: '20k-50k', mesas: null, semResposta: 'roleta' })).toBe(ROLETA)
  })

  it('segmentoDoLead', () => {
    expect(segmentoDoLead(SEGMENTO_POR_RESPOSTA, '20k-50k', 'ate-10')).toBe('low')
    expect(segmentoDoLead(SEGMENTO_POR_RESPOSTA, '20k-50k', null)).toBe('faltam_mesas')
    expect(segmentoDoLead(SEGMENTO_POR_RESPOSTA, 'acima-200k', null)).toBe('high')
  })
})

describe('faixaDoFaturamento', () => {
  it('lê o rótulo exato do formulário do site (faturamento_contato)', () => {
    expect(faixaDoFaturamento('Até 20 mil')).toBe('ate-20k')
    expect(faixaDoFaturamento('Entre 20 e 50 mil')).toBe('20k-50k')
    expect(faixaDoFaturamento('Entre 50 e 100 mil')).toBe('50k-100k')
    expect(faixaDoFaturamento('Entre 100 e 200 mil')).toBe('100k-200k')
    expect(faixaDoFaturamento('Acima de 200 mil')).toBe('acima-200k')
  })

  it('aceita sem acento ou caixa, o id e o valor em reais, com os limites de cada faixa', () => {
    expect(faixaDoFaturamento('ATE 20 MIL')).toBe('ate-20k')
    expect(faixaDoFaturamento(' 20k-50k ')).toBe('20k-50k')
    expect(faixaDoFaturamento('20000')).toBe('ate-20k')
    expect(faixaDoFaturamento('20001')).toBe('20k-50k')
    expect(faixaDoFaturamento('R$ 50.000,00')).toBe('20k-50k')
    expect(faixaDoFaturamento('75 mil')).toBe('50k-100k')
    expect(faixaDoFaturamento('150k')).toBe('100k-200k')
    expect(faixaDoFaturamento('1.200.000')).toBe('acima-200k')
  })

  it('o que não dá para entender fica sem faixa', () => {
    expect(faixaDoFaturamento('muito')).toBeNull()
    expect(faixaDoFaturamento('')).toBeNull()
    expect(faixaDoFaturamento(null)).toBeNull()
    expect(valorEmReais('12,5,3')).toBeNull()
  })
})

describe('faixaDeMesas', () => {
  it('lê o texto exato do formulário do site (quantidade_mesas)', () => {
    expect(faixaDeMesas('Até 10 mesas')).toBe('ate-10')
    expect(faixaDeMesas('De 10 a 30 Mesas')).toBe('10-30')
    expect(faixaDeMesas('Acima de 30 Mesas')).toBe('acima-30')
    expect(faixaDeMesas('Meu estabelecimento não possui mesas')).toBe('sem-mesas')
  })

  it('aceita o rótulo da página, o id e o número de mesas', () => {
    for (const f of FAIXAS_DE_MESAS) expect(faixaDeMesas(f.rotulo)).toBe(f.id)
    expect(faixaDeMesas('10-30')).toBe('10-30')
    expect(faixaDeMesas('0')).toBe('sem-mesas')
    expect(faixaDeMesas('10')).toBe('ate-10')
    expect(faixaDeMesas('11')).toBe('10-30')
    expect(faixaDeMesas('30')).toBe('10-30')
    expect(faixaDeMesas('31')).toBe('acima-30')
  })

  it('o que não dá para entender fica sem resposta', () => {
    expect(faixaDeMesas('várias')).toBeNull()
    expect(faixaDeMesas(undefined)).toBeNull()
  })
})
