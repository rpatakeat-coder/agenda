'use client'

import { CalendarX2, CircleAlert, Globe, RefreshCw } from 'lucide-react'
import { type ReactNode, useMemo, useRef, useState } from 'react'
import type { SlotPublico } from '@/lib/contrato'
import { dataNoFuso, dataPorExtenso, diaPorExtenso, horaNoFuso, nomeDoFuso } from '@/lib/formatacao'
import { Calendario } from './Calendario'
import { Estado } from './Estado'
import type { ControleDeFuso, EstadoDisponibilidade } from './hooks'
import s from './SeletorHorario.module.css'

interface Props {
  estado: EstadoDisponibilidade
  fuso: ControleDeFuso
  onEscolher: (slot: SlotPublico) => void
  onRecarregar: () => void
  titulo?: string
  aviso?: string | null
  /** Horário que não deve aparecer (o atual, na remarcação). */
  ocultar?: string | null
  /** Ação extra quando não há horário (ex.: ver outro consultor). */
  vazio?: ReactNode
  /** Linha logo abaixo do título (ex.: a faixa de faturamento escolhida). */
  extra?: ReactNode
}

/** Passos 1 e 2: o dia no calendário e o horário na lista. */
export function SeletorHorario({
  estado,
  fuso,
  onEscolher,
  onRecarregar,
  titulo = 'Escolha um dia e horário',
  aviso,
  ocultar,
  vazio,
  extra,
}: Props) {
  const [selecionada, setSelecionada] = useState<string | null>(null)
  const [mes, setMes] = useState<string | null>(null)
  const listaRef = useRef<HTMLDivElement>(null)

  // Os dias saem do fuso de quem vê: um horário de Brasília pode cair em outro dia em outro fuso.
  const porDia = useMemo(() => {
    const mapa = new Map<string, SlotPublico[]>()
    if (estado.status !== 'pronto') return mapa
    for (const dia of estado.dados.dias) {
      for (const slot of dia.slots) {
        if (slot.inicio === ocultar) continue
        const data = dataNoFuso(slot.inicio, fuso.atual)
        const lista = mapa.get(data)
        if (lista) lista.push(slot)
        else mapa.set(data, [slot])
      }
    }
    return mapa
  }, [estado, fuso.atual, ocultar])

  if (estado.status === 'carregando') return <Carregando titulo={titulo} />

  if (estado.status === 'erro')
    return (
      <Estado icone={CircleAlert} titulo="Não foi possível carregar os horários" texto={estado.mensagem}>
        <button type="button" className="botao botao-secundario" onClick={onRecarregar}>
          <RefreshCw size={18} aria-hidden /> Tentar de novo
        </button>
      </Estado>
    )

  const datas = [...porDia.keys()].sort()
  if (!datas.length)
    return (
      <Estado
        icone={CalendarX2}
        titulo="Sem horários livres nos próximos dias"
        texto="A agenda do time está cheia por enquanto. Tente de novo mais tarde."
      >
        {extra}
        {vazio}
      </Estado>
    )

  const dataAtiva = selecionada && porDia.has(selecionada) ? selecionada : datas[0]
  const hoje = dataNoFuso(new Date().toISOString(), fuso.atual)
  const slots = porDia.get(dataAtiva) ?? []

  function escolherData(data: string) {
    setSelecionada(data)
    // No celular a lista fica embaixo do calendário: leva o lead até ela.
    if (window.matchMedia('(max-width: 639px)').matches)
      requestAnimationFrame(() => listaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return (
    <div className={s.seletor}>
      <h2 className={s.titulo}>{titulo}</h2>
      {extra}
      {aviso && (
        <div role="alert" className="alerta alerta-aviso entrar">
          <CircleAlert size={18} aria-hidden />
          <p>{aviso}</p>
        </div>
      )}
      <div className={s.grade}>
        <div className={s.colunaCalendario}>
          <Calendario
            mes={mes ?? dataAtiva.slice(0, 7)}
            minMes={hoje.slice(0, 7)}
            maxMes={datas[datas.length - 1].slice(0, 7)}
            hoje={hoje}
            disponiveis={new Set(datas)}
            selecionada={dataAtiva}
            onSelecionar={escolherData}
            onMudarMes={setMes}
          />
          <div className={s.fuso}>
            <Globe size={16} aria-hidden />
            {fuso.opcoes.length > 1 ? (
              <select
                aria-label="Fuso horário"
                value={fuso.atual}
                onChange={(e) => fuso.trocar(e.target.value)}
              >
                {fuso.opcoes.map((f) => (
                  <option key={f} value={f}>
                    {nomeDoFuso(f)}
                  </option>
                ))}
              </select>
            ) : (
              <span>{nomeDoFuso(fuso.atual)}</span>
            )}
          </div>
        </div>
        <div className={s.colunaHorarios} ref={listaRef}>
          <h3 className={s.dia}>{diaPorExtenso(dataAtiva)}</h3>
          <ul key={`${dataAtiva}-${fuso.atual}`} className={`${s.horarios} entrar`}>
            {slots.map((slot) => (
              <li key={slot.inicio}>
                <button
                  type="button"
                  className={s.horario}
                  aria-label={`${horaNoFuso(slot.inicio, fuso.atual)}, ${dataPorExtenso(slot.inicio, fuso.atual)}`}
                  onClick={() => onEscolher(slot)}
                >
                  {horaNoFuso(slot.inicio, fuso.atual)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function Carregando({ titulo }: { titulo: string }) {
  return (
    <div className={s.seletor} aria-busy="true">
      <h2 className={s.titulo}>{titulo}</h2>
      <p className="sr-only" role="status">
        Carregando horários disponíveis…
      </p>
      <div className={s.grade} aria-hidden>
        <div className={s.colunaCalendario}>
          <div className="esqueleto" style={{ height: 24, width: 160 }} />
          <div className={s.esqueletoGrade}>
            {Array.from({ length: 35 }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: placeholders fixos.
              <div key={i} className={`esqueleto ${s.esqueletoDia}`} />
            ))}
          </div>
        </div>
        <div className={s.colunaHorarios}>
          <div className="esqueleto" style={{ height: 20, width: 180 }} />
          <div className={s.horarios}>
            {Array.from({ length: 6 }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: placeholders fixos.
              <div key={i} className="esqueleto" style={{ height: 48 }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
