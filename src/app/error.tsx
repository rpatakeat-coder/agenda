'use client'

import { CircleAlert, RefreshCw } from 'lucide-react'
import { Estado } from '@/components/Estado'
import { Moldura } from '@/components/Moldura'
import { MENSAGENS_DE_ERRO } from '@/lib/contrato'

export default function Erro({ reset }: { error: Error; reset: () => void }) {
  return (
    <Moldura>
      <Estado icone={CircleAlert} tom="marca" titulo="Algo deu errado" texto={MENSAGENS_DE_ERRO.erro_interno}>
        <button type="button" className="botao botao-secundario" onClick={reset}>
          <RefreshCw size={18} aria-hidden /> Tentar de novo
        </button>
      </Estado>
    </Moldura>
  )
}
