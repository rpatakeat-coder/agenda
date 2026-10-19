import { Agendador } from '@/components/Agendador'
import { leadDaUrl, origemDaUrl, type ParametrosDaUrl, vendedorDaUrl } from '@/lib/parametros'
import { regrasDaAgenda } from '@/lib/servidor/config'

/** Roleta: a reunião vai para o vendedor livre com menos compromissos no dia (ou ?vendedor=). */
export default async function PaginaDeAgendamento({
  searchParams,
}: {
  searchParams: Promise<ParametrosDaUrl>
}) {
  const busca = await searchParams
  return (
    <Agendador
      vendedor={vendedorDaUrl(busca)}
      lead={leadDaUrl(busca)}
      origem={origemDaUrl(busca)}
      duracaoMin={regrasDaAgenda().duracaoMin}
    />
  )
}
