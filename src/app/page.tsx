import { Agendador } from '@/components/Agendador'
import { VENDEDORES_POR_FAIXA } from '@/config/roteamento'
import {
  faturamentoDaUrl,
  leadDaUrl,
  origemDaUrl,
  type ParametrosDaUrl,
  vendedorDaUrl,
} from '@/lib/parametros'
import { faixaDoFaturamento, roteamentoAtivo } from '@/lib/roteamento'
import { regrasDaAgenda } from '@/lib/servidor/config'

/**
 * Roleta: a reunião vai para o vendedor livre com menos compromissos no dia, entre os que atendem a
 * faixa de faturamento do lead (src/config/roteamento.ts) — ou só o de ?vendedor=.
 */
export default async function PaginaDeAgendamento({
  searchParams,
}: {
  searchParams: Promise<ParametrosDaUrl>
}) {
  const busca = await searchParams
  return (
    <Agendador
      vendedor={vendedorDaUrl(busca)}
      faixa={faixaDoFaturamento(faturamentoDaUrl(busca))}
      perguntarFaturamento={roteamentoAtivo(VENDEDORES_POR_FAIXA)}
      lead={leadDaUrl(busca)}
      origem={origemDaUrl(busca)}
      duracaoMin={regrasDaAgenda().duracaoMin}
    />
  )
}
