// Cliente das rotas de integração da Agenda do Inside Sales no Takeat OS. Server-to-server: os
// tokens vão no header x-api-token e nunca saem deste processo.
import 'server-only'

import { z } from 'zod'
import { type AgendaDoDia, agendaDoDiaSchema } from '@/lib/agenda'
import { whatsappDoVendedor } from '@/lib/whatsapp'
import { segredo, takeatOsUrl } from './config'

const TIMEOUT_MS = 12_000

/** Erro devolvido pelo OS (`error` da resposta) ou falha de rede (`codigo: 'rede'`). */
export class ErroTakeatOS extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    readonly detalhe?: string,
  ) {
    super(`Takeat OS ${status} ${codigo}${detalhe ? `: ${detalhe}` : ''}`)
  }
}

async function chamar<T>(
  rota: string,
  pedido: { token: string; query?: Record<string, string>; corpo?: Record<string, unknown> },
  schema: z.ZodType<T>,
): Promise<T> {
  const url = new URL(`/api/integracoes/${rota}`, takeatOsUrl())
  for (const [k, v] of Object.entries(pedido.query ?? {})) url.searchParams.set(k, v)

  let resposta: Response
  try {
    resposta = await fetch(url, {
      method: pedido.corpo ? 'POST' : 'GET',
      headers: { 'x-api-token': pedido.token, 'Content-Type': 'application/json' },
      body: pedido.corpo ? JSON.stringify(pedido.corpo) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (e) {
    throw new ErroTakeatOS(0, 'rede', e instanceof Error ? e.message : String(e))
  }

  const corpo: unknown = await resposta.json().catch(() => null)
  const erro = z
    .object({ ok: z.literal(false), error: z.string(), detalhe: z.string().optional() })
    .safeParse(corpo)
  if (!resposta.ok || erro.success) {
    throw new ErroTakeatOS(
      resposta.status,
      erro.success ? erro.data.error : `http_${resposta.status}`,
      erro.success ? erro.data.detalhe : undefined,
    )
  }
  const lido = schema.safeParse(corpo)
  if (!lido.success) throw new ErroTakeatOS(502, 'resposta_inesperada', z.prettifyError(lido.error))
  return lido.data
}

// ─── Agenda do dia (com cache curto: a cópia do Google no OS só muda de 10 em 10 min) ──────────

const CACHE_MS = 60_000
const cache = new Map<string, { expira: number; promessa: Promise<AgendaDoDia> }>()

/**
 * Os eventos e as pessoas do Inside Sales num dia. `fresca` ignora o cache — é o que a criação e
 * a remarcação usam para conferir o horário antes de mexer no Google.
 */
export function agendaDoDia(data: string, { fresca = false } = {}): Promise<AgendaDoDia> {
  const agora = Date.now()
  const guardada = cache.get(data)
  if (!fresca && guardada && guardada.expira > agora) return guardada.promessa

  const promessa = chamar(
    'agenda-do-dia',
    { token: segredo('AGENDA_DO_DIA_TOKEN'), query: { data } },
    agendaDoDiaSchema,
  )
  cache.set(data, { expira: agora + CACHE_MS, promessa })
  promessa.catch(() => {
    if (cache.get(data)?.promessa === promessa) cache.delete(data)
  })
  if (cache.size > 64) {
    for (const [k, v] of cache) if (v.expira <= agora) cache.delete(k)
  }
  return promessa
}

/** Depois de criar, remarcar ou cancelar: a próxima consulta daquele dia vai ao OS. */
export const esquecerAgenda = (data: string): void => {
  cache.delete(data)
}

// ─── Eventos (criar, editar, cancelar) ─────────────────────────────────────────────────────────

const vendedorSchema = z.object({
  id: z.string(),
  nome: z.string(),
  email: z.string().nullish(),
  hubspot_owner_id: z
    .union([z.string(), z.number()])
    .nullish()
    .transform((v) => (v == null ? null : String(v))),
  /** Do cadastro do OS, como foi digitado lá; normalizado em E.164 (null se não servir). */
  whatsapp: z
    .string()
    .nullish()
    .transform((v) => whatsappDoVendedor(v)),
})

const eventoSchema = z.object({
  google_id: z.string(),
  titulo: z.string().nullish(),
  inicio: z.string(),
  fim: z.string(),
  link_meet: z.string().nullish(),
})

const respostaEventoSchema = z.object({ ok: z.literal(true), vendedor: vendedorSchema, evento: eventoSchema })

export type VendedorOS = z.output<typeof vendedorSchema>
export type RespostaEvento = z.output<typeof respostaEventoSchema>

export interface PedidoCriarEvento {
  titulo: string
  data: string
  inicio: string
  duracao: number
  convidados: string[]
  descricao: string
  /** E-mail do vendedor: a roleta é decidida aqui, não no OS (ver agendamento.ts). */
  vendedor: string
}

export const criarEvento = (pedido: PedidoCriarEvento): Promise<RespostaEvento> =>
  chamar(
    'agenda-criar-evento',
    { token: segredo('AGENDA_EVENTOS_TOKEN'), corpo: { ...pedido, meet: true } },
    respostaEventoSchema,
  )

const simulacaoSchema = z.object({
  ok: z.literal(true),
  simulacao: z.literal(true),
  vendedor: vendedorSchema,
})

/**
 * O `simular` do criar: confere que o vendedor pode receber a reunião naquele horário e traz os
 * dados dele (com o WhatsApp) — sem criar nada nem avisar ninguém. `forcar` ignora a agenda e
 * confere só a permissão.
 */
export const simularCriacao = (pedido: {
  data: string
  inicio: string
  duracao: number
  vendedor: string
  forcar?: boolean
}): Promise<VendedorOS> =>
  chamar(
    'agenda-criar-evento',
    {
      token: segredo('AGENDA_EVENTOS_TOKEN'),
      corpo: { titulo: 'Sessão de agendamento do site', ...pedido, simular: true },
    },
    simulacaoSchema,
  ).then((r) => r.vendedor)

export interface PedidoEditarEvento {
  google_id: string
  vendedor: string
  data?: string
  inicio?: string
  duracao?: number
  descricao?: string
  avisar_convidados?: boolean
}

export const editarEvento = (pedido: PedidoEditarEvento): Promise<RespostaEvento> =>
  chamar(
    'agenda-editar-evento',
    { token: segredo('AGENDA_EVENTOS_TOKEN'), corpo: { ...pedido } },
    respostaEventoSchema,
  )

export interface PedidoCancelarEvento {
  google_id: string
  vendedor: string
  avisar_convidados?: boolean
  /** Confere sem cancelar — usado também para ler a situação atual da reunião. */
  simular?: boolean
}

export const cancelarEvento = (pedido: PedidoCancelarEvento): Promise<RespostaEvento> =>
  chamar(
    'agenda-cancelar-evento',
    { token: segredo('AGENDA_EVENTOS_TOKEN'), corpo: { ...pedido } },
    respostaEventoSchema,
  )
