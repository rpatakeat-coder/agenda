import { describe, expect, it } from 'vitest'
import { VENDEDORES_POR_FAIXA } from '@/config/roteamento'
import {
  FAIXAS_DE_FATURAMENTO,
  faixaDoFaturamento,
  permitidosParaLead,
  roteamentoAtivo,
  type VendedoresPorFaixa,
  valorEmReais,
} from '../roteamento'

// O exemplo do time: João atende até 50 mil, Luiza acima de 100 mil, o meio fica na roleta.
const MAPA: VendedoresPorFaixa = {
  'ate-20k': ['joao@takeat.app'],
  '20k-50k': ['joao@takeat.app'],
  '50k-100k': 'roleta',
  '100k-200k': ['luiza@takeat.app'],
  'acima-200k': ['luiza@takeat.app', 'maria@takeat.app'],
}
const ROLETA = ['joao@takeat.app', 'luiza@takeat.app', 'maria@takeat.app', 'lucas@takeat.app']

describe('faixaDoFaturamento', () => {
  it('lê o rótulo exato do formulário do site (faturamento_contato)', () => {
    expect(faixaDoFaturamento('Até 20 mil')).toBe('ate-20k')
    expect(faixaDoFaturamento('Entre 20 e 50 mil')).toBe('20k-50k')
    expect(faixaDoFaturamento('Entre 50 e 100 mil')).toBe('50k-100k')
    expect(faixaDoFaturamento('Entre 100 e 200 mil')).toBe('100k-200k')
    expect(faixaDoFaturamento('Acima de 200 mil')).toBe('acima-200k')
  })

  it('aceita o rótulo sem acento ou caixa, e o id da faixa', () => {
    expect(faixaDoFaturamento('ATE 20 MIL')).toBe('ate-20k')
    expect(faixaDoFaturamento(' 20k-50k ')).toBe('20k-50k')
  })

  it('aceita o valor em reais (IA SDR), com os limites de cada faixa', () => {
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

describe('permitidosParaLead', () => {
  it('lead até 50 mil só vê a agenda do João', () => {
    expect(permitidosParaLead({ mapa: MAPA, roleta: ROLETA, faixa: '20k-50k' })).toEqual(['joao@takeat.app'])
    expect(permitidosParaLead({ mapa: MAPA, roleta: ROLETA, faixa: 'ate-20k' })).toEqual(['joao@takeat.app'])
  })

  it('acima de 100 mil vê só quem atende a faixa', () => {
    expect(permitidosParaLead({ mapa: MAPA, roleta: ROLETA, faixa: '100k-200k' })).toEqual([
      'luiza@takeat.app',
    ])
    expect(permitidosParaLead({ mapa: MAPA, roleta: ROLETA, faixa: 'acima-200k' })).toEqual([
      'luiza@takeat.app',
      'maria@takeat.app',
    ])
  })

  it("faixa em 'roleta' usa a lista geral", () => {
    expect(permitidosParaLead({ mapa: MAPA, roleta: ROLETA, faixa: '50k-100k' })).toBe(ROLETA)
  })

  it('com o roteamento ligado, sem faixa não tem agenda (a não ser que aceite a roleta)', () => {
    expect(permitidosParaLead({ mapa: MAPA, roleta: ROLETA, faixa: null })).toBe('faturamento_obrigatorio')
    expect(permitidosParaLead({ mapa: MAPA, roleta: ROLETA, faixa: null, semFaixa: 'roleta' })).toBe(ROLETA)
  })

  it('com tudo em roleta, o roteamento fica desligado e o faturamento não é exigido', () => {
    const tudoRoleta = Object.fromEntries(
      FAIXAS_DE_FATURAMENTO.map((f) => [f.id, 'roleta']),
    ) as unknown as VendedoresPorFaixa
    expect(roteamentoAtivo(tudoRoleta)).toBe(false)
    expect(roteamentoAtivo(MAPA)).toBe(true)
    expect(permitidosParaLead({ mapa: tudoRoleta, roleta: ROLETA, faixa: null })).toBe(ROLETA)
  })
})

describe('configuração (src/config/roteamento.ts)', () => {
  it('só tem e-mails válidos ou roleta', () => {
    for (const regra of Object.values(VENDEDORES_POR_FAIXA)) {
      if (regra === 'roleta') continue
      for (const vendedor of regra) expect(vendedor).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
    }
  })
})
