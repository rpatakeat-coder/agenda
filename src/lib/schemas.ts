// Validação compartilhada entre o formulário (navegador) e as rotas (servidor).

import { z } from 'zod'
import { normalizarTelefone, telefoneValido } from './telefone'

export const MOTIVOS_CANCELAMENTO = {
  desistencia: 'Não tenho mais interesse',
  imprevisto: 'Tive um imprevisto',
  timing: 'Não é o momento certo',
  outro: 'Outro motivo',
} as const

export type MotivoCancelamento = keyof typeof MOTIVOS_CANCELAMENTO

export const dadosLeadSchema = z.object({
  nome: z.string().trim().min(2, 'Informe seu nome.').max(80, 'Nome muito longo.'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(120, 'E-mail muito longo.')
    .pipe(z.email({ error: 'Informe um e-mail válido.' })),
  telefone: z
    .string()
    .transform(normalizarTelefone)
    .refine(telefoneValido, { error: 'Informe um WhatsApp válido, com DDD.' }),
  empresa: z.string().trim().min(2, 'Informe o nome do restaurante.').max(100, 'Nome muito longo.'),
})

export type DadosLead = z.output<typeof dadosLeadSchema>
export type CampoLead = keyof DadosLead

const texto = (max: number) => z.string().trim().max(max).optional()

/** De onde o lead veio — vai para o webhook (HubSpot), nunca para o convite. */
export const origemSchema = z.object({
  canal: texto(40),
  lead_id: texto(80),
  utm_source: texto(120),
  utm_medium: texto(120),
  utm_campaign: texto(200),
  utm_term: texto(200),
  utm_content: texto(200),
  pagina: texto(500),
})

export type Origem = z.output<typeof origemSchema>

const instante = z.iso.datetime({ offset: true, error: 'Horário inválido.' })

export const agendamentoSchema = dadosLeadSchema.extend({
  inicio: instante,
  vendedor: z.string().trim().max(120).optional(),
  origem: origemSchema.optional(),
  /** Honeypot: campo escondido que só robô preenche. */
  site: z.string().max(500).optional(),
})

export type PedidoAgendamento = z.output<typeof agendamentoSchema>

export const remarcacaoSchema = z.object({
  inicio: instante,
  /** Com outro consultor: só com a confirmação explícita do lead. */
  transferir: z.boolean().optional().default(false),
})

export const cancelamentoSchema = z.object({
  motivo: z.enum(Object.keys(MOTIVOS_CANCELAMENTO) as [MotivoCancelamento, ...MotivoCancelamento[]]),
  detalhe: z.string().trim().max(500).optional(),
})
