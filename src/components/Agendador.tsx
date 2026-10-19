'use client'

import { useState } from 'react'
import type { ReuniaoConfirmada, SlotPublico } from '@/lib/contrato'
import { dataPorExtenso, faixaDeHorario, nomeDoFuso } from '@/lib/formatacao'
import type { LeadInicial } from '@/lib/parametros'
import { type FaixaFaturamento, rotuloDaFaixa } from '@/lib/roteamento'
import type { Origem } from '@/lib/schemas'
import { Confirmacao } from './Confirmacao'
import { FormularioLead } from './FormularioLead'
import { useDisponibilidade, useFuso } from './hooks'
import { InfoDaReuniao, Moldura } from './Moldura'
import { FaixaEscolhida, PerguntaFaturamento } from './PerguntaFaturamento'
import { mostrarTopo } from './PonteEmbed'
import { SeletorHorario } from './SeletorHorario'

interface Props {
  /** Link direcionado (/caio-caiado ou ?vendedor=); null = roleta. */
  vendedor: string | null
  /** Faixa de faturamento que veio do formulário do site ou do link. */
  faixa: FaixaFaturamento | null
  /** Roteamento por faturamento ligado: sem faixa, pergunta antes do calendário. */
  perguntarFaturamento: boolean
  lead: LeadInicial
  origem: Origem
  duracaoMin: number
}

/** O fluxo de agendamento: (faturamento →) dia → horário → dados → confirmação. */
export function Agendador({ vendedor, perguntarFaturamento, lead, origem, duracaoMin, ...props }: Props) {
  const [faixa, setFaixa] = useState(props.faixa)
  // Faixa respondida aqui (e não no formulário do site): o lead pode trocar.
  const [faixaNaPagina, setFaixaNaPagina] = useState(false)
  const precisaFaixa = perguntarFaturamento && !vendedor && !faixa
  const { estado, recarregar } = useDisponibilidade({ vendedor, faturamento: faixa }, !precisaFaixa)
  const fuso = useFuso()
  const [slot, setSlot] = useState<SlotPublico | null>(null)
  const [reuniao, setReuniao] = useState<ReuniaoConfirmada | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

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

  if (precisaFaixa)
    return (
      <Moldura lateral={lateral}>
        <PerguntaFaturamento
          onEscolher={(f) => {
            setFaixa(f)
            setFaixaNaPagina(true)
            mostrarTopo()
          }}
        />
      </Moldura>
    )

  return (
    <Moldura lateral={lateral}>
      {slot ? (
        <FormularioLead
          key={slot.inicio}
          slot={slot}
          inicial={lead}
          vendedor={vendedor}
          faturamento={faixa}
          origem={origem}
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
            faixa &&
            faixaNaPagina && (
              <FaixaEscolhida
                faixa={rotuloDaFaixa(faixa)}
                onAlterar={() => {
                  setFaixa(null)
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
