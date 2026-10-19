// Respostas das rotas /api/*: sucesso, erro de negócio (com a mensagem em pt-BR para a tela) e o
// que sobra (falha do OS, configuração) — que vai para o log e chega ao lead como mensagem genérica.
import 'server-only'

import type { z } from 'zod'
import { type CodigoErro, MENSAGENS_DE_ERRO, type RespostaErro } from '@/lib/contrato'
import { ErroDeConfiguracao } from './config'
import { ErroTakeatOS } from './takeat-os'

/** Erro de negócio, com código conhecido pela tela. */
export class ErroAgenda extends Error {
  constructor(
    readonly codigo: CodigoErro,
    readonly status: number,
  ) {
    super(codigo)
  }
}

export const respostaOk = <T extends object>(dados: T, init?: ResponseInit): Response =>
  Response.json({ ok: true, ...dados }, init)

export function respostaErro(codigo: CodigoErro, status: number, campos?: Record<string, string>): Response {
  const corpo: RespostaErro = {
    ok: false,
    erro: codigo,
    mensagem: MENSAGENS_DE_ERRO[codigo],
    ...(campos && { campos }),
  }
  return Response.json(corpo, { status, headers: { 'Cache-Control': 'no-store' } })
}

export function respostaDeValidacao(erro: z.ZodError): Response {
  const campos: Record<string, string> = {}
  for (const issue of erro.issues) {
    const campo = String(issue.path[0] ?? '')
    if (campo && !campos[campo]) campos[campo] = issue.message
  }
  return respostaErro('dados_invalidos', 400, campos)
}

export function respostaDeFalha(e: unknown, onde: string): Response {
  if (e instanceof ErroAgenda) return respostaErro(e.codigo, e.status)
  if (e instanceof ErroTakeatOS) {
    // 401 é configuração, não instabilidade: diz qual token conferir.
    const dica =
      e.status === 401
        ? ' — o OS recusou o token: confira AGENDA_DO_DIA_TOKEN (leitura) e AGENDA_EVENTOS_TOKEN (criar/editar/cancelar)'
        : ''
    console.error(`[${onde}]`, e.message + dica)
    return respostaErro('agenda_indisponivel', 503)
  }
  if (e instanceof ErroDeConfiguracao) console.error(`[${onde}] configuração:`, e.message)
  else console.error(`[${onde}]`, e)
  return respostaErro('erro_interno', 500)
}

export async function lerJson(pedido: Request): Promise<unknown> {
  try {
    return await pedido.json()
  } catch {
    return null
  }
}
