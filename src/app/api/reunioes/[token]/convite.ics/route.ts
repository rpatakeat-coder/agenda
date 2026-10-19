// GET /api/reunioes/<token>/convite.ics — a reunião (no horário atual) para Apple Calendar/Outlook.
import { conteudoIcs } from '@/lib/calendario-externo'
import { situacaoDaReuniao } from '@/lib/servidor/agendamento'
import { segredo, urlPublica } from '@/lib/servidor/config'
import { respostaDeFalha, respostaErro } from '@/lib/servidor/http'
import { abrirReuniao } from '@/lib/servidor/link-reuniao'
import { excedeuLimite, ipDoPedido } from '@/lib/servidor/protecao'

export async function GET(
  pedido: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  if (excedeuLimite(`ics:${ipDoPedido(pedido)}`, 30, 10 * 60_000))
    return respostaErro('muitas_tentativas', 429)
  const { token } = await params
  try {
    const dados = abrirReuniao(token, segredo('AGENDA_LINK_SECRET'))
    if (!dados) return respostaErro('link_invalido', 404)
    const reuniao = await situacaoDaReuniao(dados)
    if (reuniao.estado === 'cancelada') return respostaErro('reuniao_cancelada', 410)

    const gestao = `${urlPublica(new URL(pedido.url).origin)}/reuniao/${token}`
    const ics = conteudoIcs({
      // O mesmo UID do evento do Google: quem também aceitou o convite não fica com duas cópias.
      uid: `${dados.g}@google.com`,
      titulo: reuniao.titulo || 'Demonstração Takeat',
      inicio: reuniao.inicio,
      fim: reuniao.fim,
      descricao: [
        `Demonstração da Takeat com ${reuniao.vendedor.nome}.`,
        reuniao.linkMeet ? `Google Meet: ${reuniao.linkMeet}` : '',
        `Remarcar ou cancelar: ${gestao}`,
      ]
        .filter(Boolean)
        .join('\n\n'),
      local: reuniao.linkMeet,
    })
    return new Response(ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="demonstracao-takeat.ics"',
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    return respostaDeFalha(e, 'convite.ics')
  }
}
