import { notFound } from 'next/navigation'
import { Agendador } from '@/components/Agendador'
import { leadDaUrl, origemDaUrl, type ParametrosDaUrl } from '@/lib/parametros'
import { regrasDaAgenda } from '@/lib/servidor/config'

/** Link direcionado: /caio-caiado (slug do nome) ou /caio@takeat.app. */
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
      lead={leadDaUrl(busca)}
      origem={origemDaUrl(busca)}
      duracaoMin={regrasDaAgenda().duracaoMin}
    />
  )
}
