// Quem pode receber o lead, conforme o que ele respondeu no formulário. Puro, para testar.
//
// As faixas são as do campo `faturamento_contato` do formulário do takeat.app (a mesma propriedade
// do HubSpot). O formulário manda o rótulo ("Entre 20 e 50 mil"); a IA SDR tem o valor em reais
// ("45000"); os links usam o id ("20k-50k"). Os três viram a mesma faixa.

import { slugDoNome } from './agenda'

export const FAIXAS_DE_FATURAMENTO = [
  { id: 'ate-20k', rotulo: 'Até 20 mil', ate: 20_000 },
  { id: '20k-50k', rotulo: 'Entre 20 e 50 mil', ate: 50_000 },
  { id: '50k-100k', rotulo: 'Entre 50 e 100 mil', ate: 100_000 },
  { id: '100k-200k', rotulo: 'Entre 100 e 200 mil', ate: 200_000 },
  { id: 'acima-200k', rotulo: 'Acima de 200 mil', ate: Number.POSITIVE_INFINITY },
] as const

export type FaixaFaturamento = (typeof FAIXAS_DE_FATURAMENTO)[number]['id']

export const IDS_DE_FAIXA = FAIXAS_DE_FATURAMENTO.map((f) => f.id) as [
  FaixaFaturamento,
  ...FaixaFaturamento[],
]

export const rotuloDaFaixa = (faixa: FaixaFaturamento): string =>
  FAIXAS_DE_FATURAMENTO.find((f) => f.id === faixa)?.rotulo ?? faixa

/** 'R$ 45.000,00' | '45 mil' | '45k' | '45000' → 45000; null se não for um valor. */
export function valorEmReais(texto: string): number | null {
  const limpo = texto.toLowerCase().replace(/r\$|\s/g, '')
  const achado = limpo.match(/^(\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?(mil|k)?$/)
  if (!achado) return null
  const numero = Number(achado[1].replace(/\./g, ''))
  return achado[2] ? numero * 1000 : numero
}

/** A faixa do lead, a partir do id, do rótulo do formulário ou do valor em reais. */
export function faixaDoFaturamento(valor: string | null | undefined): FaixaFaturamento | null {
  const texto = valor?.trim()
  if (!texto) return null
  const porId = FAIXAS_DE_FATURAMENTO.find((f) => f.id === texto.toLowerCase())
  if (porId) return porId.id
  const slug = slugDoNome(texto)
  const porRotulo = FAIXAS_DE_FATURAMENTO.find((f) => slugDoNome(f.rotulo) === slug)
  if (porRotulo) return porRotulo.id
  const reais = valorEmReais(texto)
  if (reais == null) return null
  // "Até 20 mil" inclui os 20 mil; "Entre 20 e 50 mil" começa logo acima.
  return FAIXAS_DE_FATURAMENTO.find((f) => reais <= f.ate)?.id ?? null
}

/**
 * Quem atende cada faixa: e-mails (ou nomes) do Inside Sales, ou 'roleta' — a lista geral de
 * AGENDA_VENDEDORES. O Record obriga a configuração a cobrir todas as faixas do formulário.
 */
export type VendedoresPorFaixa = Readonly<Record<FaixaFaturamento, 'roleta' | readonly [string, ...string[]]>>

/** Ligado quando pelo menos uma faixa tem vendedores próprios: aí o faturamento é obrigatório. */
export const roteamentoAtivo = (mapa: VendedoresPorFaixa): boolean =>
  Object.values(mapa).some((regra) => regra !== 'roleta')

/**
 * Os vendedores que podem receber o lead (para o filtro `permitidos`; vazio = todo o time).
 * Sem faixa com o roteamento ligado, devolve 'faturamento_obrigatorio' — a não ser que quem chama
 * aceite a roleta geral (transferência de uma reunião marcada pelo link direto de um vendedor).
 */
export function permitidosParaLead(args: {
  mapa: VendedoresPorFaixa
  roleta: readonly string[]
  faixa: FaixaFaturamento | null | undefined
  semFaixa?: 'erro' | 'roleta'
}): readonly string[] | 'faturamento_obrigatorio' {
  const { mapa, roleta, faixa } = args
  if (faixa) {
    const regra = mapa[faixa]
    return regra === 'roleta' ? roleta : regra
  }
  if (roteamentoAtivo(mapa) && args.semFaixa !== 'roleta') return 'faturamento_obrigatorio'
  return roleta
}
