// POST /api/reunioes/<token>/remarcar — { inicio, transferir? }
// Sem `transferir`: mesmo vendedor, mesmo evento e mesmo link do Meet (só muda o horário).
// Com `transferir: true` (o lead confirmou trocar de consultor): nova reunião + cancela a antiga.
import { remarcacaoSchema } from '@/lib/schemas'
import { remarcar } from '@/lib/servidor/agendamento'
import { segredo, urlPublica } from '@/lib/servidor/config'
import { lerJson, respostaDeFalha, respostaDeValidacao, respostaErro, respostaOk } from '@/lib/servidor/http'
import { abrirReuniao } from '@/lib/servidor/link-reuniao'
import { excedeuLimite, executarUmaVez, ipDoPedido } from '@/lib/servidor/protecao'

export const maxDuration = 60

export async function POST(
  pedido: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const ip = ipDoPedido(pedido)
  if (excedeuLimite(`reuniao:ip:${ip}`, 10, 10 * 60_000)) return respostaErro('muitas_tentativas', 429)

  const { token } = await params
  const lido = remarcacaoSchema.safeParse(await lerJson(pedido))
  if (!lido.success) return respostaDeValidacao(lido.error)
  try {
    const dados = abrirReuniao(token, segredo('AGENDA_LINK_SECRET'))
    if (!dados) return respostaErro('link_invalido', 404)
    const reuniao = await executarUmaVez(`remarcar:${dados.g}:${lido.data.inicio}`, 5 * 60_000, () =>
      remarcar(dados, lido.data, { baseUrl: urlPublica(new URL(pedido.url).origin) }),
    )
    return respostaOk({ reuniao }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return respostaDeFalha(e, 'remarcar')
  }
}
