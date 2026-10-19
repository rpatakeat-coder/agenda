import { notFound } from 'next/navigation'
import { Agendador } from '@/components/Agendador'
import { faturamentoDaUrl, leadDaUrl, mesasDaUrl, origemDaUrl, type ParametrosDaUrl } from '@/lib/parametros'
import { faixaDeMesas, faixaDoFaturamento } from '@/lib/roteamento'
import { regrasDaAgenda } from '@/lib/servidor/config'

/**
 * Link direcionado: /caio-caiado (slug do nome) ou /caio@takeat.app. Quem mandou o link escolheu o
 * vendedor: não pergunta faturamento nem mesas (se vierem na URL, só vão para o convite e o HubSpot).
 */
export default async function PaginaDoVendedor({
  params,
  searchParams,
}: {
  params: Promise<{ vendedor: string }>
  searchParams: Promise<ParametrosDaUrl>
}) {
  const vendedor = decodeURIComponent((await params).vendedor)
  if (!/^[\p{L}\p{N}.@_-]{2,120}$/u.test(vendedor)) notFound()
  const busca = await searchParams
  return (
    <Agendador
      vendedor={vendedor}
      respostas={{
        faixa: faixaDoFaturamento(faturamentoDaUrl(busca)),
        mesas: faixaDeMesas(mesasDaUrl(busca)),
      }}
      perguntar={{ faturamento: false, mesasPara: [] }}
      lead={leadDaUrl(busca)}
      origem={origemDaUrl(busca)}
      duracaoMin={regrasDaAgenda().duracaoMin}
    />
  )
}
