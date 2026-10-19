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
  /** Faixa do formulário ("Entre 20 e 50 mil"), id ("20k-50k") ou valor em reais. */
  faturamento: z.string().trim().max(60).optional(),
  /** Quantidade de mesas do formulário ("De 10 a 30 Mesas"), id ("10-30") ou o número. */
  mesas: z.string().trim().max(60).optional(),
  origem: origemSchema.optional(),
  /** Honeypot: campo escondido que só robô preenche. */
  site: z.string().max(500).optional(),
  /** Sessão aberta pelo formulário do site: vendedor, respostas e origem saem dela, não do navegador. */
  sessao: z.string().max(4000).optional(),
})

export type PedidoAgendamento = z.output<typeof agendamentoSchema>

const campo = z.string().trim().max(500).optional()

/**
 * O que o backend do takeat.app manda ao abrir uma sessão (POST /api/sessoes): as respostas do
 * formulário com os nomes do HubSpot, como estão. Aceita também os nomes da agenda; o resto do
 * formulário (tipo de operação, desafio…) é ignorado.
 */
export const formularioDoSiteSchema = z
  .object({
    firstname: campo,
    nome: campo,
    name: campo,
    email: campo,
    phone: campo,
    telefone: campo,
    nome_do_restaurante: campo,
    empresa: campo,
    faturamento_contato: campo,
    faturamento: campo,
    quantidade_mesas: campo,
    mesas: campo,
    lead_id: campo,
    hubspot_contact_id: campo,
    canal: campo,
    utm_source: campo,
    utm_medium: campo,
    utm_campaign: campo,
    utm_term: campo,
    utm_content: campo,
    page_uri: campo,
    pagina: campo,
  })
  .transform((f) => ({
    lead: {
      nome: f.firstname ?? f.nome ?? f.name ?? '',
      email: f.email ?? '',
      telefone: f.phone ?? f.telefone ?? '',
      empresa: f.nome_do_restaurante ?? f.empresa ?? '',
    },
    faturamento: f.faturamento_contato ?? f.faturamento ?? null,
    mesas: f.quantidade_mesas ?? f.mesas ?? null,
    // Cortado nos tamanhos do origemSchema: UTM longa não derruba a sessão.
    origem: {
      canal: (f.canal ?? 'site_formulario').slice(0, 40),
      lead_id: (f.lead_id ?? f.hubspot_contact_id)?.slice(0, 80),
      utm_source: f.utm_source?.slice(0, 120),
      utm_medium: f.utm_medium?.slice(0, 120),
      utm_campaign: f.utm_campaign?.slice(0, 200),
      utm_term: f.utm_term?.slice(0, 200),
      utm_content: f.utm_content?.slice(0, 200),
      pagina: (f.page_uri ?? f.pagina)?.slice(0, 500),
    } satisfies Origem,
  }))

export const remarcacaoSchema = z.object({
  inicio: instante,
  /** Com outro consultor: só com a confirmação explícita do lead. */
  transferir: z.boolean().optional().default(false),
})

export const cancelamentoSchema = z.object({
  motivo: z.enum(Object.keys(MOTIVOS_CANCELAMENTO) as [MotivoCancelamento, ...MotivoCancelamento[]]),
  detalhe: z.string().trim().max(500).optional(),
})
