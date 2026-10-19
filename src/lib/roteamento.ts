// Quem pode receber o lead, conforme o que ele respondeu no formulário. Puro, para testar.
//
// As respostas são as do formulário do takeat.app (propriedades do HubSpot): `faturamento_contato`
// e `quantidade_mesas`. O formulário manda o rótulo ("Entre 20 e 50 mil", "De 10 a 30 Mesas"); a
// IA SDR pode ter o número ("45000", "15"); os links usam o id ("20k-50k", "10-30"). Tudo vira a
// mesma faixa. As respostas definem o SEGMENTO do lead (HIGH, MID, LOW), e cada segmento tem os
// seus vendedores — as duas tabelas ficam em src/config/roteamento.ts.

import { slugDoNome } from './agenda'

// ─── Faturamento ───────────────────────────────────────────────────────────────────────────────

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

// ─── Mesas ─────────────────────────────────────────────────────────────────────────────────────

/** `rotulo` aparece na pergunta da página; `doFormulario` é o texto exato do takeat.app. */
export const FAIXAS_DE_MESAS = [
  { id: 'ate-10', rotulo: 'Até 10 mesas', doFormulario: 'Até 10 mesas' },
  { id: '10-30', rotulo: 'De 10 a 30 mesas', doFormulario: 'De 10 a 30 Mesas' },
  { id: 'acima-30', rotulo: 'Acima de 30 mesas', doFormulario: 'Acima de 30 Mesas' },
  {
    id: 'sem-mesas',
    rotulo: 'Não tem mesas (só delivery)',
    doFormulario: 'Meu estabelecimento não possui mesas',
  },
] as const

export type FaixaMesas = (typeof FAIXAS_DE_MESAS)[number]['id']

export const IDS_DE_MESAS = FAIXAS_DE_MESAS.map((f) => f.id) as [FaixaMesas, ...FaixaMesas[]]

export const rotuloDasMesas = (mesas: FaixaMesas): string =>
  FAIXAS_DE_MESAS.find((f) => f.id === mesas)?.rotulo ?? mesas

/** As mesas do lead, a partir do id, do texto do formulário ou do número de mesas. */
export function faixaDeMesas(valor: string | null | undefined): FaixaMesas | null {
  const texto = valor?.trim()
  if (!texto) return null
  const slug = slugDoNome(texto)
  const achada = FAIXAS_DE_MESAS.find(
    (f) =>
      f.id === texto.toLowerCase() || slug === slugDoNome(f.rotulo) || slug === slugDoNome(f.doFormulario),
  )
  if (achada) return achada.id
  if (!/^\d{1,4}$/.test(texto)) return null
  // "Até 10" inclui as 10 mesas; "De 10 a 30" começa logo acima.
  const n = Number(texto)
  if (n === 0) return 'sem-mesas'
  return n <= 10 ? 'ate-10' : n <= 30 ? '10-30' : 'acima-30'
}

// ─── Segmentos ─────────────────────────────────────────────────────────────────────────────────

export const SEGMENTOS = ['high', 'mid', 'low'] as const
export type Segmento = (typeof SEGMENTOS)[number]

/** O que o lead respondeu e decide a distribuição. */
export interface RespostasDoLead {
  faixa: FaixaFaturamento | null
  mesas: FaixaMesas | null
}

/**
 * O segmento de cada resposta de faturamento — direto, ou dependendo das mesas. Os Records obrigam
 * a configuração a cobrir todas as faixas do formulário.
 */
export type SegmentoPorResposta = Readonly<
  Record<FaixaFaturamento, Segmento | Readonly<Record<FaixaMesas, Segmento>>>
>

/** Quem atende cada segmento: e-mails do Inside Sales, ou 'roleta' (a lista de AGENDA_VENDEDORES). */
export type VendedoresPorSegmento = Readonly<Record<Segmento, 'roleta' | readonly [string, ...string[]]>>

/** Ligado quando pelo menos um segmento tem vendedores próprios: aí as respostas são obrigatórias. */
export const roteamentoAtivo = (vendedores: VendedoresPorSegmento): boolean =>
  Object.values(vendedores).some((regra) => regra !== 'roleta')

/** As faixas de faturamento cujo segmento depende das mesas (a página pergunta as mesas). */
export const faixasQueDependemDasMesas = (regra: SegmentoPorResposta): FaixaFaturamento[] =>
  IDS_DE_FAIXA.filter((faixa) => typeof regra[faixa] !== 'string')

export function segmentoDoLead(
  regra: SegmentoPorResposta,
  faixa: FaixaFaturamento,
  mesas: FaixaMesas | null | undefined,
): Segmento | 'faltam_mesas' {
  const porFaixa = regra[faixa]
  if (typeof porFaixa === 'string') return porFaixa
  return mesas ? porFaixa[mesas] : 'faltam_mesas'
}

export type FaltaResposta = 'faturamento_obrigatorio' | 'mesas_obrigatorio'

/**
 * Os vendedores que podem receber o lead (para o filtro `permitidos`; vazio = todo o time).
 * Com o roteamento ligado e resposta faltando, devolve qual falta — a não ser que quem chama aceite
 * a roleta geral (transferência de uma reunião marcada pelo link direto de um vendedor).
 */
export function permitidosParaLead(args: {
  regra: SegmentoPorResposta
  vendedores: VendedoresPorSegmento
  roleta: readonly string[]
  faixa: FaixaFaturamento | null | undefined
  mesas: FaixaMesas | null | undefined
  semResposta?: 'erro' | 'roleta'
}): readonly string[] | FaltaResposta {
  const { regra, vendedores, roleta, faixa, mesas } = args
  const exigir = roteamentoAtivo(vendedores) && args.semResposta !== 'roleta'
  if (!faixa) return exigir ? 'faturamento_obrigatorio' : roleta
  const segmento = segmentoDoLead(regra, faixa, mesas)
  if (segmento === 'faltam_mesas') return exigir ? 'mesas_obrigatorio' : roleta
  const quem = vendedores[segmento]
  return quem === 'roleta' ? roleta : quem
}
