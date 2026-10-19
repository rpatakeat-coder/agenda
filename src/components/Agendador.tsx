'use client'

import { useState } from 'react'
import type { ReuniaoConfirmada, SlotPublico } from '@/lib/contrato'
import { dataPorExtenso, faixaDeHorario, nomeDoFuso } from '@/lib/formatacao'
import type { LeadInicial } from '@/lib/parametros'
import type { Origem } from '@/lib/schemas'
import { Confirmacao } from './Confirmacao'
import { FormularioLead } from './FormularioLead'
import { useDisponibilidade, useFuso } from './hooks'
import { InfoDaReuniao, Moldura } from './Moldura'
import { mostrarTopo } from './PonteEmbed'
import { SeletorHorario } from './SeletorHorario'

interface Props {
  /** Link direcionado (/caio-caiado ou ?vendedor=); null = roleta. */
  vendedor: string | null
  lead: LeadInicial
  origem: Origem
  duracaoMin: number
}

/** O fluxo de agendamento: dia → horário → dados → confirmação. */
export function Agendador({ vendedor, lead, origem, duracaoMin }: Props) {
  const { estado, recarregar } = useDisponibilidade({ vendedor })
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

  return (
    <Moldura lateral={<InfoDaReuniao duracaoMin={duracaoMin} vendedor={nomeDoVendedor} horario={horario} />}>
      {slot ? (
        <FormularioLead
          key={slot.inicio}
          slot={slot}
          inicial={lead}
          vendedor={vendedor}
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
