'use client'

import { ChevronRight } from 'lucide-react'
import { FAIXAS_DE_FATURAMENTO, type FaixaFaturamento } from '@/lib/roteamento'
import s from './PerguntaFaturamento.module.css'

/**
 * Antes do calendário, quando o lead chega sem ter respondido o formulário do site: a faixa de
 * faturamento decide de quais especialistas aparecem os horários.
 */
export function PerguntaFaturamento({ onEscolher }: { onEscolher: (faixa: FaixaFaturamento) => void }) {
  return (
    <div className={`${s.pergunta} entrar`}>
      <div className={s.cabecalho}>
        <h2 id="pergunta-faturamento" className={s.titulo}>
          Qual o faturamento mensal do restaurante?
        </h2>
        <p className={s.texto}>Assim a gente separa o especialista certo para a sua operação.</p>
      </div>
      <ul className={s.opcoes} aria-labelledby="pergunta-faturamento">
        {FAIXAS_DE_FATURAMENTO.map((faixa) => (
          <li key={faixa.id}>
            <button type="button" className={s.opcao} onClick={() => onEscolher(faixa.id)}>
              {faixa.rotulo}
              <ChevronRight size={18} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** A faixa escolhida, em cima do calendário, com a opção de trocar. */
export function FaixaEscolhida({ faixa, onAlterar }: { faixa: string; onAlterar: () => void }) {
  return (
    <p className={s.escolhida}>
      Faturamento mensal: <strong>{faixa}</strong>
      <button type="button" className={s.alterar} onClick={onAlterar}>
        Alterar
      </button>
    </p>
  )
}
