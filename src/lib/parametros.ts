// O que a URL traz: pré-preenchimento do lead (?name=&email=&phone=&empresa=), vendedor do link
// direcionado e a origem (canal, lead_id, UTM). Tudo é só sugestão — vale o que passar no Zod.

import type { Origem } from './schemas'

export type ParametrosDaUrl = Record<string, string | string[] | undefined>

export interface LeadInicial {
  nome?: string
  email?: string
  telefone?: string
  empresa?: string
}

function primeiro(busca: ParametrosDaUrl, ...chaves: string[]): string | undefined {
  for (const chave of chaves) {
    const valor = busca[chave]
    const texto = (Array.isArray(valor) ? valor[0] : valor)?.trim()
    if (texto) return texto.slice(0, 200)
  }
  return undefined
}

export const leadDaUrl = (busca: ParametrosDaUrl): LeadInicial => ({
  nome: primeiro(busca, 'name', 'nome'),
  email: primeiro(busca, 'email'),
  telefone: primeiro(busca, 'phone', 'telefone', 'whatsapp'),
  empresa: primeiro(busca, 'empresa', 'restaurante', 'company'),
})

export const origemDaUrl = (busca: ParametrosDaUrl): Origem => ({
  canal: primeiro(busca, 'canal', 'origem') ?? 'site',
  lead_id: primeiro(busca, 'lead_id', 'leadId'),
  utm_source: primeiro(busca, 'utm_source'),
  utm_medium: primeiro(busca, 'utm_medium'),
  utm_campaign: primeiro(busca, 'utm_campaign'),
  utm_term: primeiro(busca, 'utm_term'),
  utm_content: primeiro(busca, 'utm_content'),
  pagina: primeiro(busca, 'pagina'),
})

export const vendedorDaUrl = (busca: ParametrosDaUrl): string | null =>
  primeiro(busca, 'vendedor', 'seller') ?? null
