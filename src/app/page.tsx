import { Agendador } from '@/components/Agendador'
import { SEGMENTO_POR_RESPOSTA, VENDEDORES_POR_SEGMENTO } from '@/config/roteamento'
import {
  faturamentoDaUrl,
  leadDaUrl,
  mesasDaUrl,
  origemDaUrl,
  type ParametrosDaUrl,
  sessaoDaUrl,
  vendedorDaUrl,
} from '@/lib/parametros'
import {
  faixaDeMesas,
  faixaDoFaturamento,
  faixasQueDependemDasMesas,
  roteamentoAtivo,
} from '@/lib/roteamento'
import { regrasDaAgenda } from '@/lib/servidor/config'
import { abrirSessao } from '@/lib/servidor/sessao'

/**
 * Com ?sessao= (aberta pelo formulário do site): a agenda do vendedor que a sessão escolheu, com os
 * dados do lead — nada é perguntado de novo. Sem sessão: roleta entre os vendedores do segmento do
 * lead (faturamento e mesas — src/config/roteamento.ts), ou só o de ?vendedor=.
 */
export default async function PaginaDeAgendamento({
  searchParams,
}: {
  searchParams: Promise<ParametrosDaUrl>
}) {
  const busca = await searchParams
  const ativo = roteamentoAtivo(VENDEDORES_POR_SEGMENTO)
  const perguntar = {
    faturamento: ativo,
    mesasPara: ativo ? faixasQueDependemDasMesas(SEGMENTO_POR_RESPOSTA) : [],
  }
  const duracaoMin = regrasDaAgenda().duracaoMin

  const token = sessaoDaUrl(busca)
  const sessao = token ? abrirSessao(token) : null
  if (token && sessao)
    return (
      <Agendador
        vendedor={sessao.vd?.e ?? null}
        respostas={{ faixa: sessao.fx, mesas: sessao.mx }}
        perguntar={perguntar}
        lead={{ nome: sessao.l.n, email: sessao.l.e, telefone: sessao.l.t, empresa: sessao.l.r }}
        origem={sessao.o}
        sessao={token}
        duracaoMin={duracaoMin}
      />
    )

  // Sessão vencida ou inválida cai aqui: o fluxo normal, com o que a URL trouxer.
  return (
    <Agendador
      vendedor={vendedorDaUrl(busca)}
      respostas={{
        faixa: faixaDoFaturamento(faturamentoDaUrl(busca)),
        mesas: faixaDeMesas(mesasDaUrl(busca)),
      }}
      perguntar={perguntar}
      lead={leadDaUrl(busca)}
      origem={origemDaUrl(busca)}
      duracaoMin={duracaoMin}
    />
  )
}
