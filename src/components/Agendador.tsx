'use client'

import { useState } from 'react'
import type { ReuniaoConfirmada, SlotPublico } from '@/lib/contrato'
import { dataPorExtenso, faixaDeHorario, nomeDoFuso } from '@/lib/formatacao'
import type { LeadInicial } from '@/lib/parametros'
import { type FaixaFaturamento, type RespostasDoLead, rotuloDaFaixa, rotuloDasMesas } from '@/lib/roteamento'
import type { Origem } from '@/lib/schemas'
import { Confirmacao } from './Confirmacao'
import { FormularioLead } from './FormularioLead'
import { useDisponibilidade, useFuso } from './hooks'
import { InfoDaReuniao, Moldura } from './Moldura'
import { PerguntaFaturamento, PerguntaMesas, RespostasEscolhidas } from './Perguntas'
import { mostrarTopo } from './PonteEmbed'
import { SeletorHorario } from './SeletorHorario'

interface Props {
  /** Link direcionado (/caio-caiado ou ?vendedor=); null = roleta. */
  vendedor: string | null
  /** Faturamento e mesas que vieram do formulário do site ou do link. */
  respostas: RespostasDoLead
  /** Roteamento ligado: o que perguntar antes do calendário quando não veio. */
  perguntar: { faturamento: boolean; mesasPara: readonly FaixaFaturamento[] }
  lead: LeadInicial
  origem: Origem
  /** Sessão aberta pelo formulário do site: o servidor usa o vendedor e as respostas dela. */
  sessao?: string | null
  duracaoMin: number
}

const NENHUMA_NA_PAGINA = { faixa: false, mesas: false }

/** O fluxo de agendamento: (faturamento → mesas →) dia → horário → dados → confirmação. */
export function Agendador({ vendedor, perguntar, lead, origem, sessao, duracaoMin, ...props }: Props) {
  const [respostas, setRespostas] = useState(props.respostas)
  // Respondidas aqui (e não no formulário do site): o lead pode trocar.
  const [naPagina, setNaPagina] = useState(NENHUMA_NA_PAGINA)
  const { faixa, mesas } = respostas
  const falta = vendedor
    ? null
    : perguntar.faturamento && !faixa
      ? 'faturamento'
      : faixa && perguntar.mesasPara.includes(faixa) && !mesas
        ? 'mesas'
        : null
  const { estado, recarregar } = useDisponibilidade({ vendedor, faturamento: faixa, mesas }, !falta)
  const fuso = useFuso()
  const [slot, setSlot] = useState<SlotPublico | null>(null)
  const [reuniao, setReuniao] = useState<ReuniaoConfirmada | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  function responder(resposta: Partial<RespostasDoLead>) {
    setRespostas((r) => ({ ...r, ...resposta }))
    setNaPagina((n) => ({ faixa: n.faixa || 'faixa' in resposta, mesas: n.mesas || 'mesas' in resposta }))
    mostrarTopo()
  }

  if (reuniao)
    return (
      <Moldura>
        <Confirmacao reuniao={reuniao} fuso={fuso.atual} />
      </Moldura>
    )

  const nomeDoVendedor = estado.status === 'pronto' ? (estado.dados.vendedor?.nome ?? null) : null
  const horario = slot && {
    rotulo: 'Horário escolhido',
    quando: dataPorExtenso(slot.inicio, fuso.atual),
    faixa: `${faixaDeHorario(slot.inicio, slot.fim, fuso.atual)} · ${nomeDoFuso(fuso.atual)}`,
  }
  const lateral = <InfoDaReuniao duracaoMin={duracaoMin} vendedor={nomeDoVendedor} horario={horario} />

  if (falta)
    return (
      <Moldura lateral={lateral}>
        {falta === 'faturamento' ? (
          <PerguntaFaturamento onEscolher={(f) => responder({ faixa: f })} />
        ) : (
          <PerguntaMesas onEscolher={(m) => responder({ mesas: m })} />
        )}
      </Moldura>
    )

  const respondidasAqui = [
    ...(naPagina.faixa && faixa ? [{ rotulo: 'Faturamento mensal', valor: rotuloDaFaixa(faixa) }] : []),
    ...(naPagina.mesas && mesas ? [{ rotulo: 'Mesas', valor: rotuloDasMesas(mesas) }] : []),
  ]

  return (
    <Moldura lateral={lateral}>
      {slot ? (
        <FormularioLead
          key={slot.inicio}
          slot={slot}
          inicial={lead}
          vendedor={vendedor}
          respostas={respostas}
          origem={origem}
          sessao={sessao ?? null}
          onVoltar={() => setSlot(null)}
          onConfirmada={(r) => {
            setReuniao(r)
            mostrarTopo()
          }}
          onHorarioIndisponivel={(mensagem) => {
            setAviso(mensagem)
            setSlot(null)
            recarregar()
          }}
        />
      ) : (
        <SeletorHorario
          estado={estado}
          fuso={fuso}
          aviso={aviso}
          extra={
            respondidasAqui.length > 0 && (
              <RespostasEscolhidas
                respostas={respondidasAqui}
                onAlterar={() => {
                  // Volta só o que foi respondido aqui; o que veio do formulário do site fica.
                  setRespostas((r) => ({
                    faixa: naPagina.faixa ? null : r.faixa,
                    mesas: naPagina.mesas ? null : r.mesas,
                  }))
                  setNaPagina(NENHUMA_NA_PAGINA)
                  setAviso(null)
                }}
              />
            )
          }
          onRecarregar={recarregar}
          onEscolher={(s) => {
            setAviso(null)
            setSlot(s)
            mostrarTopo()
          }}
        />
      )}
    </Moldura>
  )
}
