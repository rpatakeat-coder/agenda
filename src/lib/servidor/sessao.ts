// A sessão que o formulário do site abre na agenda (POST /api/sessoes). A agenda é a FONTE ÚNICA
// da distribuição: decide o segmento e o vendedor do lead, e o site só mostra o que ela devolve —
// o WhatsApp desse vendedor e a agenda dele. Assim o lead nunca vê um vendedor no WhatsApp e marca
// com outro, e nunca responde de novo o que já respondeu no formulário.
//
// QUEM RECEBE: entre os vendedores do segmento com horário livre logo (próximos 2 dias úteis com
// horário), a posição sai do e-mail do lead (posicaoNaRoleta) — distribuição uniforme e estável.
// O escolhido é conferido no OS com `simular` (pode receber naquele horário? qual o WhatsApp?), sem
// criar nada. Segmento sem horário nenhum: tela de WhatsApp com um vendedor do segmento.
//
// A sessão viaja selada na URL (?sessao=…): os dados do lead não ficam legíveis, ninguém troca o
// vendedor nem o segmento no navegador, e vence em 7 dias.
import 'server-only'

import { after } from 'next/server'
import { z } from 'zod'
import { SEGMENTO_POR_RESPOSTA } from '@/config/roteamento'
import { primeiroNome } from '@/lib/convite'
import {
  candidatosDaSessao,
  IDS_DE_FAIXA,
  IDS_DE_MESAS,
  posicaoNaRoleta,
  type RespostasDoLead,
  rotuloDaFaixa,
  rotuloDasMesas,
  type Segmento,
  segmentoDoLead,
} from '@/lib/roteamento'
import { type DadosLead, type Origem, origemSchema } from '@/lib/schemas'
import { DIA_MS, isoBrasilia } from '@/lib/tempo'
import { linkDoWhatsapp } from '@/lib/whatsapp'
import { regrasDaAgenda, segredo } from './config'
import { horariosDaJanela } from './disponibilidade'
import { abrir, selar } from './selo'
import { ErroTakeatOS, simularCriacao, type VendedorOS } from './takeat-os'
import { avisarWebhook } from './webhook'

const FINALIDADE = 'sessao'
const VALIDADE_MS = 7 * DIA_MS
/** Quantos vendedores conferir no OS antes de desistir (cada um é uma simulação). */
const MAX_CONFERENCIAS = 4
/** O OS recusou ESTE vendedor (sem permissão, agenda fora…): tenta o próximo da roleta. */
const RECUSAS = new Set([
  'vendedor_ocupado',
  'vendedor_sem_permissao',
  'vendedor_sem_agenda',
  'agenda_nao_confiavel',
])

const sessaoSchema = z.object({
  exp: z.number(),
  l: z.object({ n: z.string(), e: z.string(), t: z.string(), r: z.string() }),
  fx: z.enum(IDS_DE_FAIXA).nullable(),
  mx: z.enum(IDS_DE_MESAS).nullable(),
  /** O vendedor escolhido (e-mail e nome); null = ninguém do segmento disponível. */
  vd: z.object({ e: z.string(), n: z.string() }).nullable(),
  o: origemSchema,
})

export type DadosSessao = z.output<typeof sessaoSchema>

/** A sessão da URL, ou null (inválida, adulterada ou vencida). */
export function abrirSessao(token: string, agoraMs = Date.now()): DadosSessao | null {
  const dados = abrir(token, segredo('AGENDA_LINK_SECRET'), sessaoSchema, FINALIDADE)
  return dados && dados.exp > agoraMs ? dados : null
}

export interface VendedorDaSessao {
  nome: string
  email: string
  /** E.164, do cadastro do OS. */
  whatsapp: string | null
  /** wa.me com a mensagem pronta, para o botão do site. */
  whatsappUrl: string | null
  /** Para o site atribuir o contato no HubSpot. */
  hubspotOwnerId: string | null
}

export interface SessaoCriada {
  sessao: string
  /** A agenda já aberta para o vendedor escolhido. */
  url: string
  /** O que o site mostra: a agenda, ou só o WhatsApp (segmento sem horário livre). */
  tela: 'agenda' | 'whatsapp'
  segmento: Segmento | null
  vendedor: VendedorDaSessao | null
  primeiroHorario: string | null
  expiraEm: string
}

const vendedorDaSessao = (os: VendedorOS, email: string): VendedorDaSessao => ({
  nome: os.nome,
  email: os.email || email,
  whatsapp: os.whatsapp,
  whatsappUrl: os.whatsapp
    ? linkDoWhatsapp(
        os.whatsapp,
        `Olá, ${primeiroNome(os.nome)}! Acabei de preencher o formulário da Takeat.`,
      )
    : null,
  hubspotOwnerId: os.hubspot_owner_id,
})

const recusouOVendedor = (e: unknown): boolean => e instanceof ErroTakeatOS && RECUSAS.has(e.codigo)

export async function criarSessao(
  entrada: { lead: DadosLead; respostas: RespostasDoLead; origem: Origem },
  ctx: { baseUrl: string },
): Promise<SessaoCriada> {
  const regras = regrasDaAgenda()
  const { lead, respostas, origem } = entrada
  const bruto = respostas.faixa
    ? segmentoDoLead(SEGMENTO_POR_RESPOSTA, respostas.faixa, respostas.mesas)
    : null
  const segmento = bruto === 'faltam_mesas' ? null : bruto
  // Resposta faltando não trava o lead: a escolha cai na roleta geral.
  const { dias } = await horariosDaJanela({ ...respostas, semResposta: 'roleta' })

  let escolhido: { vendedor: VendedorDaSessao; primeiroHorario: string | null } | null = null
  const candidatos = candidatosDaSessao(dias)
  for (let tentativa = 0; candidatos.length && tentativa < MAX_CONFERENCIAS; tentativa++) {
    const [c] = candidatos.splice(posicaoNaRoleta(lead.email, candidatos.length), 1)
    try {
      const os = await simularCriacao({
        data: c.data,
        inicio: c.slot.horario,
        duracao: regras.duracaoMin,
        vendedor: c.vendedor.email,
      })
      escolhido = {
        vendedor: vendedorDaSessao(os, c.vendedor.email),
        primeiroHorario: isoBrasilia(c.slot.inicioMs),
      }
      break
    } catch (e) {
      if (!recusouOVendedor(e)) throw e
      console.warn(`[sessao] OS recusou ${c.vendedor.nome} (${e instanceof Error ? e.message : e}); próximo.`)
    }
  }

  // Ninguém do segmento com horário: o lead fala no WhatsApp com alguém do segmento.
  if (!escolhido) {
    const doSegmento = (dias.find((d) => d.vendedores.length)?.vendedores ?? []).toSorted((a, b) =>
      a.email.localeCompare(b.email),
    )
    const ultimoDia = dias[dias.length - 1]?.data
    for (let tentativa = 0; doSegmento.length && ultimoDia && tentativa < MAX_CONFERENCIAS; tentativa++) {
      const [v] = doSegmento.splice(posicaoNaRoleta(lead.email, doSegmento.length), 1)
      try {
        // `forcar` ignora a agenda: aqui só importa quem é e o WhatsApp.
        const os = await simularCriacao({
          data: ultimoDia,
          inicio: '10:00',
          duracao: regras.duracaoMin,
          vendedor: v.email,
          forcar: true,
        })
        escolhido = { vendedor: vendedorDaSessao(os, v.email), primeiroHorario: null }
        break
      } catch (e) {
        if (!recusouOVendedor(e)) throw e
      }
    }
  }

  const exp = Date.now() + VALIDADE_MS
  const sessao = selar(
    {
      exp,
      l: { n: lead.nome, e: lead.email, t: lead.telefone, r: lead.empresa },
      fx: respostas.faixa,
      mx: respostas.mesas,
      vd: escolhido ? { e: escolhido.vendedor.email, n: escolhido.vendedor.nome } : null,
      o: origem,
    } satisfies DadosSessao,
    segredo('AGENDA_LINK_SECRET'),
    FINALIDADE,
  )
  const criada: SessaoCriada = {
    sessao,
    url: `${ctx.baseUrl}/?sessao=${sessao}`,
    tela: escolhido?.primeiroHorario ? 'agenda' : 'whatsapp',
    segmento,
    vendedor: escolhido?.vendedor ?? null,
    primeiroHorario: escolhido?.primeiroHorario ?? null,
    expiraEm: isoBrasilia(exp),
  }

  after(() =>
    avisarWebhook('lead.distribuido', {
      lead,
      faturamento: respostas.faixa
        ? { faixa: respostas.faixa, rotulo: rotuloDaFaixa(respostas.faixa) }
        : null,
      mesas: respostas.mesas ? { faixa: respostas.mesas, rotulo: rotuloDasMesas(respostas.mesas) } : null,
      segmento,
      tela: criada.tela,
      vendedor: criada.vendedor,
      primeiro_horario: criada.primeiroHorario,
      agenda_url: criada.url,
      origem,
    }),
  )
  return criada
}
