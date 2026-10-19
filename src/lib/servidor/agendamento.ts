// Criar, remarcar e cancelar a reunião do lead no Google (pelo Takeat OS).
//
// ROLETA: decidida aqui, não no OS. O horário é conferido contra a agenda fresca e os vendedores
// livres vêm na ordem da roleta (menos compromissos no dia primeiro); cada criação vai com o
// `vendedor` explícito. Se o OS recusa aquele vendedor (sem permissão de criar, ocupado por uma
// reunião que acabou de entrar…), tenta o próximo. Isso evita que dois pedidos simultâneos caiam
// no mesmo vendedor e respeita AGENDA_VENDEDORES — o "primeiro livre" do OS não faria nenhum dos dois.
import 'server-only'

import { after } from 'next/server'
import { SEGMENTO_POR_RESPOSTA } from '@/config/roteamento'
import type { ReuniaoConfirmada, ReuniaoPublica } from '@/lib/contrato'
import { descricaoDoConvite, tituloDoConvite } from '@/lib/convite'
import { type RespostasDoLead, rotuloDaFaixa, rotuloDasMesas, segmentoDoLead } from '@/lib/roteamento'
import { type DadosLead, MOTIVOS_CANCELAMENTO, type MotivoCancelamento, type Origem } from '@/lib/schemas'
import { dataBrasilia } from '@/lib/tempo'
import { regrasDaAgenda, segredo, tituloBase } from './config'
import { conferirHorario } from './disponibilidade'
import { ErroAgenda } from './http'
import { type DadosReuniao, selarReuniao } from './link-reuniao'
import {
  cancelarEvento,
  criarEvento,
  ErroTakeatOS,
  editarEvento,
  esquecerAgenda,
  type RespostaEvento,
} from './takeat-os'
import { avisarWebhook, type EventoWebhook } from './webhook'

const MAX_TENTATIVAS = 6
/** O OS recusou ESTE vendedor, mas outro livre no horário pode receber. */
const RECUSAS_DO_VENDEDOR = new Set([
  'vendedor_ocupado',
  'vendedor_sem_permissao',
  'vendedor_sem_agenda',
  'agenda_nao_confiavel',
])

const erroDoOS = (e: unknown, ...codigos: string[]): boolean =>
  e instanceof ErroTakeatOS && codigos.includes(e.codigo)

const mensagem = (e: unknown): unknown => (e instanceof Error ? e.message : e)

const linkDeGestao = (dados: DadosReuniao, baseUrl: string): string =>
  `${baseUrl}/reuniao/${selarReuniao(dados, segredo('AGENDA_LINK_SECRET'))}`

const leadDe = (dados: DadosReuniao): DadosLead => ({
  nome: dados.l.n,
  email: dados.l.e,
  telefone: dados.l.t,
  empresa: dados.l.r,
})

const respostasDe = (dados: DadosReuniao): RespostasDoLead => ({ faixa: dados.fx, mesas: dados.mx ?? null })

/** As respostas em texto, para o convite (o vendedor vê; o segmento não vai — o lead também lê). */
const respostasNoConvite = ({ faixa, mesas }: RespostasDoLead) => ({
  faturamento: faixa && rotuloDaFaixa(faixa),
  mesas: mesas && rotuloDasMesas(mesas),
})

function dadosDaReuniao(
  r: RespostaEvento,
  emailVendedor: string,
  lead: DadosLead,
  respostas: RespostasDoLead,
): DadosReuniao {
  return {
    g: r.evento.google_id,
    v: r.vendedor.email || emailVendedor,
    vn: r.vendedor.nome,
    i: r.evento.inicio,
    f: r.evento.fim,
    l: { n: lead.nome, e: lead.email, t: lead.telefone, r: lead.empresa },
    fx: respostas.faixa,
    mx: respostas.mesas,
  }
}

const confirmada = (
  dados: DadosReuniao,
  evento: { titulo: string; linkMeet: string | null; whatsapp?: string | null },
  gestaoUrl: string,
): ReuniaoConfirmada => ({
  titulo: evento.titulo,
  inicio: dados.i,
  fim: dados.f,
  linkMeet: evento.linkMeet,
  vendedor: { nome: dados.vn, email: dados.v, whatsapp: evento.whatsapp ?? null },
  emailLead: dados.l.e,
  gestaoUrl,
})

/** O que o webhook leva de uma reunião — com o owner do HubSpot do vendedor e o segmento do lead. */
const paraWebhook = (
  r: RespostaEvento,
  lead: DadosLead,
  { origem, respostas }: { origem?: Origem; respostas?: RespostasDoLead } = {},
) => {
  const { faixa, mesas } = respostas ?? { faixa: null, mesas: null }
  const segmento = faixa ? segmentoDoLead(SEGMENTO_POR_RESPOSTA, faixa, mesas) : null
  return {
    reuniao: {
      google_id: r.evento.google_id,
      titulo: r.evento.titulo ?? null,
      inicio: r.evento.inicio,
      fim: r.evento.fim,
      link_meet: r.evento.link_meet ?? null,
    },
    vendedor: r.vendedor,
    lead,
    faturamento: faixa ? { faixa, rotulo: rotuloDaFaixa(faixa) } : null,
    mesas: mesas ? { faixa: mesas, rotulo: rotuloDasMesas(mesas) } : null,
    segmento: segmento === 'faltam_mesas' ? null : segmento,
    origem: origem ?? null,
  }
}

export interface PedidoDeReuniao {
  lead: DadosLead
  inicio: string
  vendedor?: string | null
  /** Faturamento e mesas: definem o segmento e quem pode receber o lead. */
  respostas?: RespostasDoLead
  semResposta?: 'erro' | 'roleta'
  origem?: Origem
}

interface Aviso {
  evento: EventoWebhook
  extra?: Record<string, unknown>
}

export async function agendar(
  pedido: PedidoDeReuniao,
  ctx: { baseUrl: string },
  aviso: Aviso = { evento: 'reuniao.agendada' },
): Promise<ReuniaoConfirmada> {
  const regras = regrasDaAgenda()
  const respostas = pedido.respostas ?? { faixa: null, mesas: null }
  const noConvite = respostasNoConvite(respostas)
  const { slot, agenda, data } = await conferirHorario(pedido.inicio, {
    vendedor: pedido.vendedor,
    ...respostas,
    semResposta: pedido.semResposta,
  })
  const titulo = tituloDoConvite(tituloBase(), pedido.lead)
  // Trava entre instâncias contra clique duplo: o OS já mostra na hora o evento criado pela rota.
  if (agenda.eventos.some((e) => e.titulo === titulo && Date.parse(e.inicio) === slot.inicioMs))
    throw new ErroAgenda('ja_agendado', 409)

  for (const vendedor of slot.vendedores.slice(0, MAX_TENTATIVAS)) {
    let criado: RespostaEvento
    try {
      criado = await criarEvento({
        titulo,
        data,
        inicio: slot.horario,
        duracao: regras.duracaoMin,
        convidados: [pedido.lead.email],
        descricao: descricaoDoConvite(pedido.lead, { vendedor: vendedor.nome, ...noConvite }),
        vendedor: vendedor.email,
      })
    } catch (e) {
      if (!erroDoOS(e, ...RECUSAS_DO_VENDEDOR)) throw e
      console.warn(`[agendar] OS recusou ${vendedor.nome}: ${mensagem(e)} — tentando o próximo.`)
      continue
    }

    esquecerAgenda(data)
    const dados = dadosDaReuniao(criado, vendedor.email, pedido.lead, respostas)
    const gestaoUrl = linkDeGestao(dados, ctx.baseUrl)
    after(() =>
      Promise.all([
        // O link de gestão depende do google_id: entra na descrição depois, sem novo e-mail.
        editarEvento({
          google_id: dados.g,
          vendedor: dados.v,
          descricao: descricaoDoConvite(pedido.lead, {
            vendedor: dados.vn,
            linkDeGestao: gestaoUrl,
            ...noConvite,
          }),
          avisar_convidados: false,
        }).catch((e) => console.error('[agendar] link de gestão no convite:', mensagem(e))),
        avisarWebhook(aviso.evento, {
          ...paraWebhook(criado, pedido.lead, { origem: pedido.origem, respostas }),
          gestao_url: gestaoUrl,
          ...aviso.extra,
        }),
      ]),
    )
    return confirmada(
      dados,
      {
        titulo: criado.evento.titulo ?? titulo,
        linkMeet: criado.evento.link_meet ?? null,
        whatsapp: criado.vendedor.whatsapp,
      },
      gestaoUrl,
    )
  }
  throw new ErroAgenda('horario_indisponivel', 409)
}

/**
 * A situação atual da reunião, lida no OS (o `simular` do cancelar confere o evento sem mexer em
 * nada). Assim o link do convite continua certo mesmo depois de remarcar.
 */
export async function situacaoDaReuniao(dados: DadosReuniao): Promise<ReuniaoPublica> {
  const doLink = {
    titulo: '',
    inicio: dados.i,
    fim: dados.f,
    linkMeet: null,
    vendedor: { nome: dados.vn },
    emailLead: dados.l.e,
  }
  try {
    const r = await cancelarEvento({ google_id: dados.g, vendedor: dados.v, simular: true })
    return {
      estado: 'agendada',
      titulo: r.evento.titulo ?? '',
      inicio: r.evento.inicio,
      fim: r.evento.fim,
      linkMeet: r.evento.link_meet ?? null,
      vendedor: { nome: r.vendedor.nome },
      emailLead: dados.l.e,
    }
  } catch (e) {
    if (erroDoOS(e, 'evento_nao_encontrado')) return { ...doLink, estado: 'cancelada' }
    if (erroDoOS(e, 'evento_encerrado')) return { ...doLink, estado: 'encerrada' }
    throw e
  }
}

function exigirAgendada(reuniao: ReuniaoPublica): void {
  if (reuniao.estado === 'cancelada') throw new ErroAgenda('reuniao_cancelada', 410)
  if (reuniao.estado === 'encerrada') throw new ErroAgenda('reuniao_encerrada', 409)
}

export async function remarcar(
  dados: DadosReuniao,
  pedido: { inicio: string; transferir: boolean },
  ctx: { baseUrl: string },
): Promise<ReuniaoConfirmada> {
  const atual = await situacaoDaReuniao(dados)
  exigirAgendada(atual)
  const lead = leadDe(dados)
  const de = { inicio: atual.inicio, fim: atual.fim, vendedor: dados.vn, google_id: dados.g }

  if (pedido.transferir) {
    // Outro consultor (com a confirmação explícita do lead): primeiro garante a nova, depois
    // cancela a antiga — o lead nunca fica sem reunião. Continua no segmento do lead; reunião
    // marcada pelo link direto de um vendedor (sem respostas) vai para a roleta.
    const nova = await agendar(
      {
        lead,
        inicio: pedido.inicio,
        respostas: respostasDe(dados),
        semResposta: 'roleta',
        origem: { canal: 'remarcacao' },
      },
      ctx,
      { evento: 'reuniao.remarcada', extra: { transferida: true, de } },
    )
    try {
      await cancelarEvento({ google_id: dados.g, vendedor: dados.v, avisar_convidados: true })
      esquecerAgenda(dataBrasilia(Date.parse(atual.inicio)))
    } catch (e) {
      console.error(`[remarcar] transferida, mas a reunião antiga ${dados.g} não foi cancelada:`, mensagem(e))
    }
    return nova
  }

  if (Date.parse(pedido.inicio) === Date.parse(atual.inicio)) {
    const iguais: DadosReuniao = { ...dados, i: atual.inicio, f: atual.fim }
    return confirmada(iguais, atual, linkDeGestao(iguais, ctx.baseUrl))
  }

  const { slot, data } = await conferirHorario(pedido.inicio, {
    vendedor: dados.v,
    ignorar: { email: dados.v, inicioMs: Date.parse(atual.inicio), fimMs: Date.parse(atual.fim) },
  })
  let editado: RespostaEvento
  try {
    // Só data e horário: descrição e convidados ficam como estão (o vendedor pode ter anotado algo).
    editado = await editarEvento({
      google_id: dados.g,
      vendedor: dados.v,
      data,
      inicio: slot.horario,
      duracao: regrasDaAgenda().duracaoMin,
      avisar_convidados: true,
    })
  } catch (e) {
    if (erroDoOS(e, 'vendedor_ocupado', 'inicio_no_passado'))
      throw new ErroAgenda('horario_indisponivel', 409)
    if (erroDoOS(e, 'evento_nao_encontrado')) throw new ErroAgenda('reuniao_cancelada', 410)
    if (erroDoOS(e, 'evento_encerrado')) throw new ErroAgenda('reuniao_encerrada', 409)
    throw e
  }

  esquecerAgenda(dataBrasilia(Date.parse(atual.inicio)))
  esquecerAgenda(data)
  const novos: DadosReuniao = { ...dados, i: editado.evento.inicio, f: editado.evento.fim }
  const gestaoUrl = linkDeGestao(novos, ctx.baseUrl)
  after(() =>
    avisarWebhook('reuniao.remarcada', {
      ...paraWebhook(editado, lead, { respostas: respostasDe(dados) }),
      de,
      gestao_url: gestaoUrl,
    }),
  )
  return confirmada(
    novos,
    {
      titulo: editado.evento.titulo ?? atual.titulo,
      linkMeet: editado.evento.link_meet ?? atual.linkMeet,
      whatsapp: editado.vendedor.whatsapp,
    },
    gestaoUrl,
  )
}

export async function cancelar(
  dados: DadosReuniao,
  motivo: MotivoCancelamento,
  detalhe?: string,
): Promise<ReuniaoPublica> {
  let cancelado: RespostaEvento | null = null
  try {
    cancelado = await cancelarEvento({ google_id: dados.g, vendedor: dados.v, avisar_convidados: true })
  } catch (e) {
    if (erroDoOS(e, 'evento_encerrado')) throw new ErroAgenda('reuniao_encerrada', 409)
    // Já cancelada (no Google ou num clique anterior): para o lead, o resultado é o mesmo.
    if (!erroDoOS(e, 'evento_nao_encontrado')) throw e
  }

  const inicio = cancelado?.evento.inicio ?? dados.i
  esquecerAgenda(dataBrasilia(Date.parse(inicio)))
  if (cancelado) {
    const r = cancelado
    after(() =>
      avisarWebhook('reuniao.cancelada', {
        ...paraWebhook(r, leadDe(dados), { respostas: respostasDe(dados) }),
        motivo,
        motivo_texto: MOTIVOS_CANCELAMENTO[motivo],
        detalhe: detalhe || null,
      }),
    )
  }
  return {
    estado: 'cancelada',
    titulo: cancelado?.evento.titulo ?? '',
    inicio,
    fim: cancelado?.evento.fim ?? dados.f,
    linkMeet: null,
    vendedor: { nome: dados.vn },
    emailLead: dados.l.e,
  }
}
