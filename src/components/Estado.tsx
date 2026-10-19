import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import s from './Estado.module.css'

/** Tela de estado (vazio, erro, cancelada…): ícone, título, texto e uma ação. */
export function Estado({
  icone: Icone,
  titulo,
  texto,
  tom = 'neutro',
  children,
}: {
  icone: LucideIcon
  titulo: string
  texto?: ReactNode
  tom?: 'neutro' | 'marca' | 'sucesso'
  children?: ReactNode
}) {
  return (
    <div className={`${s.estado} entrar`}>
      <span className={`${s.icone} ${s[tom]}`}>
        <Icone size={28} aria-hidden />
      </span>
      <h2 className={s.titulo}>{titulo}</h2>
      {texto && <p className={s.texto}>{texto}</p>}
      {children && <div className={s.acoes}>{children}</div>}
    </div>
  )
}
