// Horários livres da janela de agendamento, a partir do agenda-do-dia do OS (um pedido por dia).
import 'server-only'

import { SEGMENTO_POR_RESPOSTA, VENDEDORES_POR_SEGMENTO } from '@/config/roteamento'
import { type AgendaDoDia, type FiltroVendedores, resolverVendedor, vendedoresElegiveis } from '@/lib/agenda'
import type { Disponibilidade } from '@/lib/contrato'
import { type FaixaFaturamento, type FaixaMesas, permitidosParaLead } from '@/lib/roteamento'
import { calcularSlots, diasDaJanela, type SlotCalculado } from '@/lib/slots'
import { dataBrasilia, isoBrasilia } from '@/lib/tempo'
import { regrasDaAgenda, vendedoresPermitidos } from './config'
import { ErroAgenda } from './http'
import { agendaDoDia } from './takeat-os'

export interface OpcoesDeAgenda {
  /** Link direcionado: nome/slug ou e-mail do vendedor. */
  vendedor?: string | null
  /** Respostas do lead (faturamento e mesas): decidem o segmento e quem pode recebê-lo. */
  faixa?: FaixaFaturamento | null
  mesas?: FaixaMesas | null
  /** Resposta faltando com o roteamento ligado: erro (padrão) ou a roleta geral. */
  semResposta?: 'erro' | 'roleta'
  ignorar?: FiltroVendedores['ignorar']
}

/**
 * O filtro do dia. Sem link direcionado: os vendedores do segmento do lead (src/config/roteamento.ts)
 * ou a roleta. Link direcionado: só aquele vendedor, que precisa existir — quem mandou o link escolheu.
 */
function filtroDoDia(
  agenda: AgendaDoDia,
  opcoes: OpcoesDeAgenda,
): FiltroVendedores & { nome: string | null } {
  if (!opcoes.vendedor) {
    const permitidos = permitidosParaLead({
      regra: SEGMENTO_POR_RESPOSTA,
      vendedores: VENDEDORES_POR_SEGMENTO,
      roleta: vendedoresPermitidos(),
      faixa: opcoes.faixa,
      mesas: opcoes.mesas,
      semResposta: opcoes.semResposta,
    })
    if (typeof permitidos === 'string') throw new ErroAgenda(permitidos, 400)
    return { permitidos, ignorar: opcoes.ignorar, nome: null }
  }
  const achado = resolverVendedor(agenda.pessoas, opcoes.vendedor)
  if ('erro' in achado) throw new ErroAgenda('vendedor_nao_encontrado', 404)
  return { permitidos: [], vendedor: achado.pessoa.email, ignorar: opcoes.ignorar, nome: achado.pessoa.nome }
}

export async function consultarDisponibilidade(opcoes: OpcoesDeAgenda): Promise<Disponibilidade> {
  const regras = regrasDaAgenda()
  const agoraMs = Date.now()
  const datas = diasDaJanela(dataBrasilia(agoraMs), regras)
  const resultados = await Promise.allSettled(datas.map((data) => agendaDoDia(data)))

  const agendas: AgendaDoDia[] = []
  for (const r of resultados) {
    if (r.status === 'fulfilled') agendas.push(r.value)
    else console.error('[disponibilidade] dia sem resposta do OS:', r.reason)
  }
  const primeira = agendas[0]
  if (!primeira) throw (resultados[0] as PromiseRejectedResult).reason

  const filtro = filtroDoDia(primeira, opcoes)
  return {
    duracaoMin: regras.duracaoMin,
    vendedor: filtro.nome ? { nome: filtro.nome } : null,
    dias: agendas.map((agenda) => ({
      data: agenda.data,
      slots: calcularSlots({
        data: agenda.data,
        vendedores: vendedoresElegiveis(agenda, filtro),
        regras,
        agoraMs,
      }).map((s) => ({ inicio: isoBrasilia(s.inicioMs), fim: isoBrasilia(s.fimMs) })),
    })),
  }
}

/**
 * Confere o horário pedido contra a agenda FRESCA do dia (sem cache) e devolve o slot com os
 * vendedores livres na ordem da roleta. Lança horario_indisponivel se ele não vale mais.
 */
export async function conferirHorario(
  inicioIso: string,
  opcoes: OpcoesDeAgenda,
): Promise<{ slot: SlotCalculado; agenda: AgendaDoDia; data: string }> {
  const regras = regrasDaAgenda()
  const agoraMs = Date.now()
  const inicioMs = Date.parse(inicioIso)
  const data = dataBrasilia(inicioMs)
  if (!diasDaJanela(dataBrasilia(agoraMs), regras).includes(data))
    throw new ErroAgenda('horario_indisponivel', 409)

  const agenda = await agendaDoDia(data, { fresca: true })
  const vendedores = vendedoresElegiveis(agenda, filtroDoDia(agenda, opcoes))
  const slot = calcularSlots({ data, vendedores, regras, agoraMs }).find((s) => s.inicioMs === inicioMs)
  if (!slot) throw new ErroAgenda('horario_indisponivel', 409)
  return { slot, agenda, data }
}
