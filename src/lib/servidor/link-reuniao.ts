// O link de remarcar/cancelar (/reuniao/<token>), como o do Calendly: quem tem o link gerencia a
// reunião. O token é selado (src/lib/servidor/selo.ts) — carrega o google_id e os dados do lead,
// que não podem ficar legíveis numa URL.
import 'server-only'

import { z } from 'zod'
import { IDS_DE_FAIXA, IDS_DE_MESAS } from '@/lib/roteamento'
import { abrir, selar } from './selo'

const dadosSchema = z.object({
  /** google_id do evento. */
  g: z.string().min(1),
  /** E-mail e nome do vendedor que organiza. */
  v: z.string().min(1),
  vn: z.string(),
  /** Início e fim quando o link foi gerado (a página confere a situação atual no OS). */
  i: z.string(),
  f: z.string(),
  /** Lead: nome, e-mail, WhatsApp, restaurante — para transferir de consultor sem pedir de novo. */
  l: z.object({ n: z.string(), e: z.string(), t: z.string(), r: z.string() }),
  /** Faturamento e mesas: a transferência de consultor continua no segmento do lead. */
  fx: z.enum(IDS_DE_FAIXA).nullable(),
  // Opcional: links gerados antes das mesas entrarem na distribuição não têm o campo.
  mx: z.enum(IDS_DE_MESAS).nullable().optional(),
})

export type DadosReuniao = z.infer<typeof dadosSchema>

export const selarReuniao = (dados: DadosReuniao, segredo: string): string => selar(dados, segredo)

/** Devolve os dados ou null (token malformado, adulterado ou de outro segredo). */
export const abrirReuniao = (token: string, segredo: string): DadosReuniao | null =>
  abrir(token, segredo, dadosSchema)
