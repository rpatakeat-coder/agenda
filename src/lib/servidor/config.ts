// Configuração lida das variáveis de ambiente (ver .env.example). Só no servidor: os tokens do
// Takeat OS nunca vão para o navegador.
import 'server-only'

import type { RegrasAgenda } from '@/lib/slots'
import { dataValida, horarioValido, paraMinutos } from '@/lib/tempo'

export class ErroDeConfiguracao extends Error {}

const env = (nome: string): string | undefined => process.env[nome]?.trim() || undefined

const lista = (nome: string): string[] =>
  (env(nome) ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

function inteiro(nome: string, padrao: number, min: number, max: number): number {
  const bruto = env(nome)
  if (bruto == null) return padrao
  const n = Number(bruto)
  if (!Number.isInteger(n) || n < min || n > max)
    throw new ErroDeConfiguracao(`${nome} precisa ser um inteiro entre ${min} e ${max}.`)
  return n
}

function faixa(nome: string, padrao: string): { inicio: number; fim: number } {
  const [de = '', ate = ''] = (env(nome) ?? padrao).split('-').map((s) => s.trim())
  if (!horarioValido(de) || !horarioValido(ate) || paraMinutos(ate) <= paraMinutos(de))
    throw new ErroDeConfiguracao(`${nome} precisa ser HH:MM-HH:MM (ex.: 09:00-18:00).`)
  return { inicio: paraMinutos(de), fim: paraMinutos(ate) }
}

let regras: RegrasAgenda | null = null

export function regrasDaAgenda(): RegrasAgenda {
  if (regras) return regras
  const almoco =
    env('AGENDA_ALMOCO')?.toLowerCase() === 'nenhum' ? null : faixa('AGENDA_ALMOCO', '12:00-13:00')
  const dias = lista('AGENDA_DIAS_DA_SEMANA').map(Number)
  if (dias.some((d) => !Number.isInteger(d) || d < 0 || d > 6))
    throw new ErroDeConfiguracao('AGENDA_DIAS_DA_SEMANA: números de 0 (domingo) a 6 (sábado).')
  const feriados = lista('AGENDA_FERIADOS_EXTRAS')
  const invalido = feriados.find((d) => !dataValida(d))
  if (invalido) throw new ErroDeConfiguracao(`AGENDA_FERIADOS_EXTRAS: data inválida "${invalido}".`)

  regras = {
    expediente: faixa('AGENDA_EXPEDIENTE', '09:00-18:00'),
    almoco,
    diasDaSemana: dias.length ? dias : [1, 2, 3, 4, 5],
    duracaoMin: inteiro('AGENDA_DURACAO_MIN', 30, 10, 180),
    passoMin: inteiro('AGENDA_PASSO_MIN', 30, 5, 180),
    bufferMin: inteiro('AGENDA_BUFFER_MIN', 10, 0, 120),
    antecedenciaMin: inteiro('AGENDA_ANTECEDENCIA_MIN', 120, 0, 7 * 24 * 60),
    janelaDiasUteis: inteiro('AGENDA_JANELA_DIAS_UTEIS', 14, 1, 30),
    feriadosExtras: new Set(feriados),
  }
  return regras
}

type Segredo = 'AGENDA_DO_DIA_TOKEN' | 'AGENDA_EVENTOS_TOKEN' | 'AGENDA_LINK_SECRET'

export function segredo(nome: Segredo): string {
  const valor = env(nome)
  if (!valor) throw new ErroDeConfiguracao(`${nome} não configurado.`)
  if (nome === 'AGENDA_LINK_SECRET' && valor.length < 32)
    throw new ErroDeConfiguracao('AGENDA_LINK_SECRET precisa ter pelo menos 32 caracteres.')
  return valor
}

export const takeatOsUrl = (): string => env('TAKEAT_OS_URL') ?? 'https://takeatos.vercel.app'

/** Quem entra na roleta do site (AGENDA_VENDEDORES). Vazio = todo o time com agenda confiável. */
export const vendedoresPermitidos = (): string[] => lista('AGENDA_VENDEDORES')

export const tituloBase = (): string => env('AGENDA_TITULO') ?? 'Demo Takeat'

/** A URL pública do site (para os links do convite); sem a env, a origem do pedido. */
export const urlPublica = (origemDoPedido: string): string =>
  (env('AGENDA_URL_PUBLICA') ?? origemDoPedido).replace(/\/+$/, '')

export const configWebhook = (): { url?: string; segredo?: string } => ({
  url: env('AGENDA_WEBHOOK_URL'),
  segredo: env('AGENDA_WEBHOOK_SECRET'),
})
