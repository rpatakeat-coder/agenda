// Diagnóstico da integração com o Takeat OS, com os tokens do .env.local:
//   1. lê o agenda-do-dia (quem está no time, se a agenda é confiável, quantos compromissos);
//   2. testa, para cada pessoa com agenda confiável, se o site consegue criar reunião na agenda
//      dela — com `simular: true`: nada vai ao Google nem a ninguém.
// No fim, sugere o AGENDA_VENDEDORES (quem pode receber reunião do site).
//
//   npm run diagnostico                 próximo dia útil, 10:00
//   npm run diagnostico -- 2026-10-21   outro dia

const base = (process.env.TAKEAT_OS_URL || 'https://takeatos.vercel.app').replace(/\/+$/, '')
const tokenDoDia = process.env.AGENDA_DO_DIA_TOKEN
const tokenDeEventos = process.env.AGENDA_EVENTOS_TOKEN
if (!tokenDoDia || !tokenDeEventos) {
  console.error('Preencha AGENDA_DO_DIA_TOKEN e AGENDA_EVENTOS_TOKEN no .env.local.')
  process.exit(1)
}

const BRT_MS = 3 * 3_600_000
function proximoDiaUtil() {
  const d = new Date(Date.now() - BRT_MS)
  do d.setUTCDate(d.getUTCDate() + 1)
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6)
  return d.toISOString().slice(0, 10)
}
const data = process.argv[2] || proximoDiaUtil()
const HORARIO = '10:00'

async function chamar(rota, { token, query, corpo }) {
  const url = new URL(`/api/integracoes/${rota}`, base)
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v)
  const r = await fetch(url, {
    method: corpo ? 'POST' : 'GET',
    headers: { 'x-api-token': token, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(20_000),
  })
  return { status: r.status, corpo: await r.json().catch(() => ({})) }
}

console.log(`Takeat OS: ${base}\nDia: ${data}, ${HORARIO}\n`)

const dia = await chamar('agenda-do-dia', { token: tokenDoDia, query: { data, horario: HORARIO } })
if (dia.status !== 200) {
  console.error(`agenda-do-dia → HTTP ${dia.status} ${dia.corpo.error ?? ''}`)
  if (dia.status === 401) console.error('AGENDA_DO_DIA_TOKEN errado.')
  process.exit(1)
}
const { pessoas = [], eventos = [] } = dia.corpo
const quantas = (situacao) => pessoas.filter((p) => p.situacao === situacao).length
console.log(
  `1) Leitura OK — ${pessoas.length} pessoas, ${eventos.length} eventos no dia ` +
    `(sem agenda: ${quantas('sem_agenda')}, com erro: ${quantas('agenda_com_erro')}, ` +
    `desatualizada: ${quantas('agenda_desatualizada')})\n`,
)

const confiaveis = pessoas.filter((p) => p.situacao === 'livre' || p.situacao === 'ocupado')
const resultados = []
let tokenDeEventosRecusado = false
for (const p of pessoas) {
  let escrita = '—'
  if (tokenDeEventosRecusado && confiaveis.includes(p)) escrita = 'não testado'
  else if (confiaveis.includes(p)) {
    // `forcar` isola a permissão: não importa se a pessoa está ocupada às 10:00.
    const r = await chamar('agenda-criar-evento', {
      token: tokenDeEventos,
      corpo: {
        titulo: 'Diagnóstico Agenda Site',
        data,
        inicio: HORARIO,
        vendedor: p.email,
        forcar: true,
        simular: true,
      },
    })
    // Token de eventos errado: a tabela ainda mostra a leitura, sem testar a escrita de ninguém.
    tokenDeEventosRecusado = r.status === 401
    escrita = tokenDeEventosRecusado
      ? 'não testado'
      : r.status === 200
        ? `pode criar (acesso ${r.corpo.acesso_a_agenda})`
        : (r.corpo.error ?? `HTTP ${r.status}`)
  }
  resultados.push({
    nome: p.nome,
    email: p.email,
    agenda: p.situacao,
    compromissos: p.compromissos_no_dia,
    escrita,
  })
}

console.log('2) Quem pode receber reunião do site (simulação, nada foi criado):')
console.table(resultados)

if (tokenDeEventosRecusado) {
  console.error(
    '\nagenda-criar-evento → 401: AGENDA_EVENTOS_TOKEN recusado — é o segredo de mesmo nome na Vercel do OS ' +
      '(diferente do AGENDA_DO_DIA_TOKEN). A escrita não foi testada.',
  )
  process.exit(1)
}

const podem = resultados.filter((r) => r.escrita.startsWith('pode criar')).map((r) => r.email)
console.log(`\nSugestão para o .env / Vercel:\nAGENDA_VENDEDORES=${podem.join(',')}`)
if (!podem.length)
  console.log(
    '\nNinguém pode criar: a agenda vai aparecer vazia até alguém "Conectar de novo" em /inside-sales/agenda.',
  )
