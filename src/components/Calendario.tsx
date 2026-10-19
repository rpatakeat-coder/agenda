'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { diaPorExtenso, nomeDoMes } from '@/lib/formatacao'
import { diaDaSemana } from '@/lib/tempo'
import s from './Calendario.module.css'

const SEMANA = [
  ['DOM', 'domingo'],
  ['SEG', 'segunda-feira'],
  ['TER', 'terça-feira'],
  ['QUA', 'quarta-feira'],
  ['QUI', 'quinta-feira'],
  ['SEX', 'sexta-feira'],
  ['SÁB', 'sábado'],
] as const

/** 'AAAA-MM' + n meses. */
export function somarMes(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1 + n, 1)).toISOString().slice(0, 7)
}

function diasDoMes(mes: string): string[] {
  const [a, m] = mes.split('-').map(Number)
  const total = new Date(Date.UTC(a, m, 0)).getUTCDate()
  return Array.from({ length: total }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`)
}

interface Props {
  /** 'AAAA-MM' */
  mes: string
  minMes: string
  maxMes: string
  hoje: string
  disponiveis: ReadonlySet<string>
  selecionada: string | null
  onSelecionar: (data: string) => void
  onMudarMes: (mes: string) => void
}

export function Calendario({
  mes,
  minMes,
  maxMes,
  hoje,
  disponiveis,
  selecionada,
  onSelecionar,
  onMudarMes,
}: Props) {
  const vazios = diaDaSemana(`${mes}-01`)
  return (
    <div className={s.calendario}>
      <div className={s.cabecalho}>
        <h3 className={s.mes} aria-live="polite">
          {nomeDoMes(mes)}
        </h3>
        <div className={s.navegacao}>
          <button
            type="button"
            className={s.seta}
            aria-label="Mês anterior"
            disabled={mes <= minMes}
            onClick={() => onMudarMes(somarMes(mes, -1))}
          >
            <ChevronLeft size={20} aria-hidden />
          </button>
          <button
            type="button"
            className={s.seta}
            aria-label="Próximo mês"
            disabled={mes >= maxMes}
            onClick={() => onMudarMes(somarMes(mes, 1))}
          >
            <ChevronRight size={20} aria-hidden />
          </button>
        </div>
      </div>
      <div className={s.grade}>
        {SEMANA.map(([curto, longo]) => (
          <abbr key={longo} title={longo} className={s.semana}>
            {curto}
          </abbr>
        ))}
        {Array.from({ length: vazios }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: células vazias fixas antes do dia 1.
          <span key={`vazio-${i}`} aria-hidden />
        ))}
        {diasDoMes(mes).map((data) => {
          const livre = disponiveis.has(data)
          const classes = [
            s.dia,
            livre && s.livre,
            data === selecionada && s.selecionado,
            data === hoje && s.hoje,
          ]
          return (
            <button
              key={data}
              type="button"
              className={classes.filter(Boolean).join(' ')}
              disabled={!livre}
              aria-pressed={livre ? data === selecionada : undefined}
              aria-label={`${diaPorExtenso(data)}${livre ? '' : ', sem horários'}`}
              onClick={() => onSelecionar(data)}
            >
              {Number(data.slice(8))}
            </button>
          )
        })}
      </div>
    </div>
  )
}
