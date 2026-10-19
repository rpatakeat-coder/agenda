import type { Metadata } from 'next'
import { GerenciarReuniao } from '@/components/GerenciarReuniao'
import { MENSAGENS_DE_ERRO, type ReuniaoPublica } from '@/lib/contrato'
import { situacaoDaReuniao } from '@/lib/servidor/agendamento'
import { regrasDaAgenda, segredo } from '@/lib/servidor/config'
import { abrirReuniao } from '@/lib/servidor/link-reuniao'

export const metadata: Metadata = {
  title: 'Sua reunião · Takeat',
  robots: { index: false, follow: false },
}

/** O link do convite: ver, remarcar ou cancelar a reunião. */
export default async function PaginaDaReuniao({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  let reuniao: ReuniaoPublica | null = null
  let erro: string | null = null

  const dados = abrirReuniao(token, segredo('AGENDA_LINK_SECRET'))
  if (!dados) erro = MENSAGENS_DE_ERRO.link_invalido
  else {
    try {
      reuniao = await situacaoDaReuniao(dados)
    } catch (e) {
      console.error('[reuniao]', e instanceof Error ? e.message : e)
      erro = MENSAGENS_DE_ERRO.agenda_indisponivel
    }
  }

  return (
    <GerenciarReuniao token={token} inicial={reuniao} erro={erro} duracaoMin={regrasDaAgenda().duracaoMin} />
  )
}
