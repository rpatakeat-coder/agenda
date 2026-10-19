import { CalendarX2 } from 'lucide-react'
import { Estado } from '@/components/Estado'
import { Moldura } from '@/components/Moldura'

export default function NaoEncontrada() {
  return (
    <Moldura>
      <Estado icone={CalendarX2} titulo="Página não encontrada" texto="Confira o link que você recebeu.">
        <a href="/" className="botao botao-primario">
          Agendar uma demonstração
        </a>
      </Estado>
    </Moldura>
  )
}
