import { CalendarDays, Clock, Video } from 'lucide-react'
import Image from 'next/image'
import type { ReactNode } from 'react'
import logo from '../../public/logo-takeat.png'
import s from './Moldura.module.css'

/** O cartão da página: painel com os dados da reunião ao lado (embaixo, no celular) e o conteúdo. */
export function Moldura({ lateral, children }: { lateral?: ReactNode; children: ReactNode }) {
  return (
    <div className={s.pagina}>
      <div className={`${s.cartao} ${lateral ? '' : s.semLateral}`}>
        {lateral && <aside className={s.lateral}>{lateral}</aside>}
        <main className={s.principal}>{children}</main>
      </div>
    </div>
  )
}

export function Logo() {
  return <Image src={logo} alt="Takeat" priority className={s.logo} />
}

interface InfoProps {
  duracaoMin: number
  vendedor: string | null
  /** O horário escolhido (ou o atual, na remarcação). */
  horario?: { rotulo: string; quando: string; faixa: string } | null
}

export function InfoDaReuniao({ duracaoMin, vendedor, horario }: InfoProps) {
  return (
    <div className={s.info}>
      <Logo />
      <div className={s.cabecalho}>
        <p className={s.sobretitulo}>{vendedor ? `Com ${vendedor}` : 'Time comercial Takeat'}</p>
        <h1 className={s.titulo}>Demonstração Takeat</h1>
      </div>
      <ul className={s.meta}>
        <li>
          <Clock size={16} aria-hidden /> {duracaoMin} min
        </li>
        <li>
          <Video size={16} aria-hidden /> Google Meet
        </li>
      </ul>
      {horario && (
        <div className={`${s.horario} entrar`}>
          <CalendarDays size={18} aria-hidden />
          <div>
            <p className={s.horarioRotulo}>{horario.rotulo}</p>
            <p className={s.horarioQuando}>{horario.quando}</p>
            <p>{horario.faixa}</p>
          </div>
        </div>
      )}
      <p className={s.descricao}>
        Uma conversa com um especialista para entender a operação do seu restaurante e mostrar a Takeat
        funcionando na prática.
      </p>
    </div>
  )
}
