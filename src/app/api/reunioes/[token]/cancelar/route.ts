// POST /api/reunioes/<token>/cancelar — { motivo, detalhe? }
// Cancela para todos (o Google avisa os convidados). O motivo vai para o webhook (HubSpot).
import { cancelamentoSchema } from '@/lib/schemas'
import { cancelar } from '@/lib/servidor/agendamento'
import { segredo } from '@/lib/servidor/config'
import { lerJson, respostaDeFalha, respostaDeValidacao, respostaErro, respostaOk } from '@/lib/servidor/http'
import { abrirReuniao } from '@/lib/servidor/link-reuniao'
import { excedeuLimite, executarUmaVez, ipDoPedido } from '@/lib/servidor/protecao'

export const maxDuration = 30

export async function POST(
  pedido: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const ip = ipDoPedido(pedido)
  if (excedeuLimite(`reuniao:ip:${ip}`, 10, 10 * 60_000)) return respostaErro('muitas_tentativas', 429)

  const { token } = await params
  const lido = cancelamentoSchema.safeParse(await lerJson(pedido))
  if (!lido.success) return respostaDeValidacao(lido.error)
  try {
    const dados = abrirReuniao(token, segredo('AGENDA_LINK_SECRET'))
    if (!dados) return respostaErro('link_invalido', 404)
    const reuniao = await executarUmaVez(`cancelar:${dados.g}`, 5 * 60_000, () =>
      cancelar(dados, lido.data.motivo, lido.data.detalhe),
    )
    return respostaOk({ reuniao }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return respostaDeFalha(e, 'cancelar')
  }
}
