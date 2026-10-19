// POST /api/sessoes — o backend do takeat.app abre a sessão de agendamento de um lead que acabou de
// preencher o formulário. SERVER-TO-SERVER: header `x-api-token` = AGENDA_SITE_TOKEN (nunca no
// navegador). Corpo: as respostas do formulário como estão (firstname, email, phone,
// nome_do_restaurante, faturamento_contato, quantidade_mesas, utm_*…).
//
// Devolve o que o site mostra: `tela` ("agenda" ou "whatsapp"), o vendedor escolhido (com WhatsApp e
// owner do HubSpot) e `url`/`sessao` da agenda já aberta para ele — o lead não responde nada de novo.
import { faixaDeMesas, faixaDoFaturamento } from '@/lib/roteamento'
import { dadosLeadSchema, formularioDoSiteSchema } from '@/lib/schemas'
import { tokenConfere, urlPublica } from '@/lib/servidor/config'
import { lerJson, respostaDeFalha, respostaDeValidacao, respostaErro, respostaOk } from '@/lib/servidor/http'
import { excedeuLimite, ipDoPedido } from '@/lib/servidor/protecao'
import { criarSessao } from '@/lib/servidor/sessao'

export const maxDuration = 60

export async function POST(pedido: Request): Promise<Response> {
  try {
    if (!tokenConfere(pedido.headers.get('x-api-token'), 'AGENDA_SITE_TOKEN'))
      return respostaErro('nao_autorizado', 401)
  } catch (e) {
    return respostaDeFalha(e, 'sessoes') // sem AGENDA_SITE_TOKEN: falha fechada
  }
  // Todas as chamadas vêm do servidor do site (mesmo IP): o teto é alto, só contra laço.
  if (excedeuLimite(`sessoes:${ipDoPedido(pedido)}`, 300, 60_000))
    return respostaErro('muitas_tentativas', 429)

  const formulario = formularioDoSiteSchema.safeParse(await lerJson(pedido))
  if (!formulario.success) return respostaDeValidacao(formulario.error)
  const lead = dadosLeadSchema.safeParse(formulario.data.lead)
  if (!lead.success) return respostaDeValidacao(lead.error)

  try {
    const sessao = await criarSessao(
      {
        lead: lead.data,
        respostas: {
          faixa: faixaDoFaturamento(formulario.data.faturamento),
          mesas: faixaDeMesas(formulario.data.mesas),
        },
        origem: formulario.data.origem,
      },
      { baseUrl: urlPublica(new URL(pedido.url).origin) },
    )
    return respostaOk(sessao, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return respostaDeFalha(e, 'sessoes')
  }
}
