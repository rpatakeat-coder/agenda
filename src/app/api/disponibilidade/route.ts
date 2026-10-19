// GET /api/disponibilidade — horários livres da janela de agendamento.
//   ?faturamento=20k-50k         faixa do lead: só os vendedores dela (src/config/roteamento.ts)
//   ?vendedor=caio-caiado        link direcionado (nome/slug ou e-mail)
//   ?reuniao=<token>             remarcação: só o vendedor da reunião, sem contar a própria reunião
//   ?reuniao=<token>&transferir=1  remarcação com outro consultor (roleta)
// Só sai início e fim de horários livres — nunca compromisso de vendedor.
import { faixaDoFaturamento } from '@/lib/roteamento'
import { segredo } from '@/lib/servidor/config'
import { consultarDisponibilidade, type OpcoesDeAgenda } from '@/lib/servidor/disponibilidade'
import { respostaDeFalha, respostaErro, respostaOk } from '@/lib/servidor/http'
import { abrirReuniao } from '@/lib/servidor/link-reuniao'
import { excedeuLimite, ipDoPedido } from '@/lib/servidor/protecao'

export const dynamic = 'force-dynamic'

export async function GET(pedido: Request): Promise<Response> {
  if (excedeuLimite(`disponibilidade:${ipDoPedido(pedido)}`, 60, 60_000))
    return respostaErro('muitas_tentativas', 429)

  const params = new URL(pedido.url).searchParams
  const token = params.get('reuniao')
  try {
    let opcoes: OpcoesDeAgenda = {
      vendedor: params.get('vendedor')?.trim().slice(0, 120) || null,
      faixa: faixaDoFaturamento(params.get('faturamento')),
    }
    if (token) {
      const dados = abrirReuniao(token, segredo('AGENDA_LINK_SECRET'))
      if (!dados) return respostaErro('link_invalido', 404)
      opcoes =
        params.get('transferir') === '1'
          ? { faixa: dados.fx, semFaixa: 'roleta' }
          : {
              vendedor: dados.v,
              ignorar: { email: dados.v, inicioMs: Date.parse(dados.i), fimMs: Date.parse(dados.f) },
            }
    }
    const disponibilidade = await consultarDisponibilidade(opcoes)
    return respostaOk(disponibilidade, {
      headers: {
        // CDN da Vercel segura 60 s (o OS copia o Google de 10 em 10 min); a criação reconfere fresco.
        'Cache-Control': token ? 'private, no-store' : 'public, s-maxage=60, stale-while-revalidate=120',
      },
    })
  } catch (e) {
    return respostaDeFalha(e, 'disponibilidade')
  }
}
