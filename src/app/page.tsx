import { Agendador } from '@/components/Agendador'
import { SEGMENTO_POR_RESPOSTA, VENDEDORES_POR_SEGMENTO } from '@/config/roteamento'
import {
  faturamentoDaUrl,
  leadDaUrl,
  mesasDaUrl,
  origemDaUrl,
  type ParametrosDaUrl,
  vendedorDaUrl,
} from '@/lib/parametros'
import {
  faixaDeMesas,
  faixaDoFaturamento,
  faixasQueDependemDasMesas,
  roteamentoAtivo,
} from '@/lib/roteamento'
import { regrasDaAgenda } from '@/lib/servidor/config'

/**
 * Roleta: a reunião vai para o vendedor livre com menos compromissos no dia, entre os do segmento do
 * lead (faturamento e mesas — src/config/roteamento.ts) — ou só o de ?vendedor=.
 */
export default async function PaginaDeAgendamento({
  searchParams,
}: {
  searchParams: Promise<ParametrosDaUrl>
}) {
  const busca = await searchParams
  const ativo = roteamentoAtivo(VENDEDORES_POR_SEGMENTO)
  return (
    <Agendador
      vendedor={vendedorDaUrl(busca)}
      respostas={{
        faixa: faixaDoFaturamento(faturamentoDaUrl(busca)),
        mesas: faixaDeMesas(mesasDaUrl(busca)),
      }}
      perguntar={{
        faturamento: ativo,
        mesasPara: ativo ? faixasQueDependemDasMesas(SEGMENTO_POR_RESPOSTA) : [],
      }}
      lead={leadDaUrl(busca)}
      origem={origemDaUrl(busca)}
      duracaoMin={regrasDaAgenda().duracaoMin}
    />
  )
}
