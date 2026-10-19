// POST /api/agendamentos — cria a reunião com Google Meet na agenda do vendedor.
// Header opcional `Idempotency-Key`: o mesmo valor devolve a mesma reunião (clique duplo).
import { faixaDeMesas, faixaDoFaturamento } from '@/lib/roteamento'
import { agendamentoSchema } from '@/lib/schemas'
import { agendar } from '@/lib/servidor/agendamento'
import { urlPublica } from '@/lib/servidor/config'
import {
  ErroAgenda,
  lerJson,
  respostaDeFalha,
  respostaDeValidacao,
  respostaErro,
  respostaOk,
} from '@/lib/servidor/http'
import { excedeuLimite, executarUmaVez, ipDoPedido } from '@/lib/servidor/protecao'
import { abrirSessao } from '@/lib/servidor/sessao'

export const maxDuration = 60

const DEZ_MIN = 10 * 60_000
const UMA_HORA = 60 * 60_000

export async function POST(pedido: Request): Promise<Response> {
  const ip = ipDoPedido(pedido)
  if (excedeuLimite(`agendar:ip:${ip}`, 10, DEZ_MIN)) return respostaErro('muitas_tentativas', 429)

  const lido = agendamentoSchema.safeParse(await lerJson(pedido))
  if (!lido.success) return respostaDeValidacao(lido.error)
  const { site, inicio, sessao, vendedor, origem, faturamento, mesas, ...lead } = lido.data
  // Honeypot preenchido: robô. Resposta genérica, sem dizer o porquê.
  if (site) return respostaErro('dados_invalidos', 400)

  const chave = pedido.headers.get('idempotency-key')?.trim().slice(0, 100) || null
  try {
    // Sessão do formulário do site: vendedor, respostas e origem saem dela (fonte única) — o que o
    // navegador mandar nesses campos é ignorado. Sessão vencida: vale o que veio no pedido.
    const daSessao = sessao ? abrirSessao(sessao) : null
    const distribuicao = daSessao
      ? {
          vendedor: daSessao.vd?.e ?? null,
          respostas: { faixa: daSessao.fx, mesas: daSessao.mx },
          origem: daSessao.o,
        }
      : {
          vendedor,
          respostas: { faixa: faixaDoFaturamento(faturamento), mesas: faixaDeMesas(mesas) },
          origem,
        }
    // O limite por contato fica dentro: o segundo clique (mesma chave) não conta como tentativa.
    const reuniao = await executarUmaVez(chave && `${ip}:${chave}`, 15 * 60_000, async () => {
      if (
        excedeuLimite(`agendar:email:${lead.email}`, 5, UMA_HORA) ||
        excedeuLimite(`agendar:telefone:${lead.telefone}`, 5, UMA_HORA)
      )
        throw new ErroAgenda('muitas_tentativas', 429)
      return agendar({ lead, inicio, ...distribuicao }, { baseUrl: urlPublica(new URL(pedido.url).origin) })
    })
    return respostaOk({ reuniao }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return respostaDeFalha(e, 'agendamentos')
  }
}
