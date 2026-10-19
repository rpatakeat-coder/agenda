'use client'

import { useCallback, useEffect, useState } from 'react'
import { type Disponibilidade, MENSAGENS_DE_ERRO, type Resposta } from '@/lib/contrato'
import { deslocamento } from '@/lib/formatacao'
import { FUSO_BRASILIA } from '@/lib/tempo'

export type EstadoDisponibilidade =
  | { status: 'carregando' }
  | { status: 'erro'; mensagem: string }
  | { status: 'pronto'; dados: Disponibilidade }

/** Horários livres de /api/disponibilidade. `recarregar` fura o cache da CDN (horário recém-ocupado). */
export function useDisponibilidade(params: Record<string, string | null | undefined>) {
  const busca = new URLSearchParams(
    Object.entries(params).filter((par): par is [string, string] => Boolean(par[1])),
  ).toString()
  const [estado, setEstado] = useState<EstadoDisponibilidade>({ status: 'carregando' })
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    const controle = new AbortController()
    setEstado({ status: 'carregando' })
    const query = new URLSearchParams(busca)
    if (versao) query.set('v', String(Date.now()))
    fetch(`/api/disponibilidade?${query}`, { signal: controle.signal })
      .then((r) => r.json() as Promise<Resposta<Disponibilidade>>)
      .then((r) =>
        setEstado(r.ok ? { status: 'pronto', dados: r } : { status: 'erro', mensagem: r.mensagem }),
      )
      .catch(() => {
        if (!controle.signal.aborted)
          setEstado({ status: 'erro', mensagem: MENSAGENS_DE_ERRO.agenda_indisponivel })
      })
    return () => controle.abort()
  }, [busca, versao])

  const recarregar = useCallback(() => setVersao((v) => v + 1), [])
  return { estado, recarregar }
}

export interface ControleDeFuso {
  atual: string
  opcoes: string[]
  trocar: (fuso: string) => void
}

/**
 * O fuso da tela: o do aparelho do lead quando ele é diferente do de Brasília (com opção de ver
 * em Brasília), senão Brasília. Lido depois de montar — no servidor não existe o fuso do lead.
 */
export function useFuso(): ControleDeFuso {
  const [local, setLocal] = useState<string | null>(null)
  const [escolhido, setEscolhido] = useState<string | null>(null)
  useEffect(() => {
    const fuso = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (fuso && deslocamento(fuso) !== deslocamento(FUSO_BRASILIA)) setLocal(fuso)
  }, [])
  const opcoes = local ? [local, FUSO_BRASILIA] : [FUSO_BRASILIA]
  return { atual: escolhido ?? opcoes[0], opcoes, trocar: setEscolhido }
}

/** POST JSON para as rotas da agenda; falha de rede vira erro com mensagem para o lead. */
export async function postar<T extends object>(
  url: string,
  corpo: unknown,
  cabecalhos: Record<string, string> = {},
): Promise<Resposta<T>> {
  try {
    const resposta = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...cabecalhos },
      body: JSON.stringify(corpo),
    })
    return (await resposta.json()) as Resposta<T>
  } catch {
    return { ok: false, erro: 'agenda_indisponivel', mensagem: MENSAGENS_DE_ERRO.agenda_indisponivel }
  }
}

export const novaChave = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
