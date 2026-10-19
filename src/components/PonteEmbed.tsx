'use client'

// Conversa com a página que embute a agenda (public/embed.js): manda a altura do conteúdo, para o
// <iframe> crescer sem barra de rolagem, e avisa quando a reunião é marcada (conversão no site).
// As mensagens não levam dado pessoal — só altura e horário.

import { useEffect } from 'react'

export type MensagemAoSite =
  | { tipo: 'takeat-agenda:altura'; altura: number }
  | { tipo: 'takeat-agenda:etapa' }
  | { tipo: 'takeat-agenda:agendado'; inicio: string; fim: string }
  | { tipo: 'takeat-agenda:remarcado'; inicio: string; fim: string }
  | { tipo: 'takeat-agenda:cancelado' }

const embutido = (): boolean => typeof window !== 'undefined' && window.parent !== window

export function avisarSite(mensagem: MensagemAoSite): void {
  if (embutido()) window.parent.postMessage(mensagem, '*')
}

/** Troca de etapa: leva o lead ao topo — da página, ou do <iframe> na página do site. */
export function mostrarTopo(): void {
  if (embutido()) avisarSite({ tipo: 'takeat-agenda:etapa' })
  else window.scrollTo({ top: 0, behavior: 'smooth' })
}

export function PonteEmbed() {
  useEffect(() => {
    if (!embutido()) return
    let ultima = 0
    const enviar = () => {
      const altura = Math.ceil(document.body.getBoundingClientRect().height)
      if (altura === ultima) return
      ultima = altura
      avisarSite({ tipo: 'takeat-agenda:altura', altura })
    }
    const observador = new ResizeObserver(enviar)
    observador.observe(document.body)
    enviar()
    return () => observador.disconnect()
  }, [])
  return null
}
