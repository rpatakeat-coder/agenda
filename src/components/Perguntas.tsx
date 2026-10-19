'use client'

// Antes do calendário, quando o lead chega sem ter respondido o formulário do site: faturamento e
// (para quem fatura até 50 mil) mesas decidem de quais especialistas aparecem os horários.

import { ChevronRight } from 'lucide-react'
import {
  FAIXAS_DE_FATURAMENTO,
  FAIXAS_DE_MESAS,
  type FaixaFaturamento,
  type FaixaMesas,
} from '@/lib/roteamento'
import s from './Perguntas.module.css'

interface PerguntaProps<T extends string> {
  id: string
  titulo: string
  texto: string
  opcoes: ReadonlyArray<{ id: T; rotulo: string }>
  onEscolher: (opcao: T) => void
}

function Pergunta<T extends string>({ id, titulo, texto, opcoes, onEscolher }: PerguntaProps<T>) {
  return (
    <div className={`${s.pergunta} entrar`}>
      <div className={s.cabecalho}>
        <h2 id={id} className={s.titulo}>
          {titulo}
        </h2>
        <p className={s.texto}>{texto}</p>
      </div>
      <ul className={s.opcoes} aria-labelledby={id}>
        {opcoes.map((opcao) => (
          <li key={opcao.id}>
            <button type="button" className={s.opcao} onClick={() => onEscolher(opcao.id)}>
              {opcao.rotulo}
              <ChevronRight size={18} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PerguntaFaturamento({ onEscolher }: { onEscolher: (faixa: FaixaFaturamento) => void }) {
  return (
    <Pergunta
      id="pergunta-faturamento"
      titulo="Qual o faturamento mensal do restaurante?"
      texto="Assim a gente separa o especialista certo para a sua operação."
      opcoes={FAIXAS_DE_FATURAMENTO}
      onEscolher={onEscolher}
    />
  )
}

export function PerguntaMesas({ onEscolher }: { onEscolher: (mesas: FaixaMesas) => void }) {
  return (
    <Pergunta
      id="pergunta-mesas"
      titulo="Quantas mesas o restaurante tem?"
      texto="Só mais essa, para a demonstração ser do tamanho da sua operação."
      opcoes={FAIXAS_DE_MESAS}
      onEscolher={onEscolher}
    />
  )
}

/** As respostas dadas aqui, em cima do calendário, com a opção de trocar. */
export function RespostasEscolhidas({
  respostas,
  onAlterar,
}: {
  respostas: ReadonlyArray<{ rotulo: string; valor: string }>
  onAlterar: () => void
}) {
  return (
    <p className={s.escolhida}>
      {respostas.map((r, i) => (
        <span key={r.rotulo}>
          {i > 0 && ' · '}
          {r.rotulo}: <strong>{r.valor}</strong>
        </span>
      ))}
      <button type="button" className={s.alterar} onClick={onAlterar}>
        Alterar
      </button>
    </p>
  )
}
