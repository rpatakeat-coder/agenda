// "Adicionar à agenda": link do Google Agenda e arquivo .ics (Apple Calendar, Outlook). Puro.

export interface EventoParaAgenda {
  uid: string
  titulo: string
  inicio: string
  fim: string
  descricao: string
  local?: string | null
}

/** ISO → '20261021T123000Z' (UTC, formato das duas integrações). */
const utcCompacto = (instante: string | number): string =>
  new Date(instante)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')

export function linkGoogleAgenda(evento: Omit<EventoParaAgenda, 'uid'>): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: evento.titulo,
    dates: `${utcCompacto(evento.inicio)}/${utcCompacto(evento.fim)}`,
    details: evento.descricao,
  })
  if (evento.local) params.set('location', evento.local)
  return `https://calendar.google.com/calendar/render?${params}`
}

const escapar = (texto: string): string =>
  texto.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** RFC 5545: linhas de até 75 bytes; a continuação começa com um espaço. */
function dobrar(linha: string): string {
  const codificador = new TextEncoder()
  const partes: string[] = []
  let atual = ''
  let bytes = 0
  for (const caractere of linha) {
    const tamanho = codificador.encode(caractere).length
    if (bytes + tamanho > (partes.length ? 74 : 75)) {
      partes.push(atual)
      atual = ''
      bytes = 0
    }
    atual += caractere
    bytes += tamanho
  }
  partes.push(atual)
  return partes.join('\r\n ')
}

export function conteudoIcs(evento: EventoParaAgenda, agoraMs = Date.now()): string {
  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Takeat//Agenda//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${evento.uid}`,
    `DTSTAMP:${utcCompacto(agoraMs)}`,
    `DTSTART:${utcCompacto(evento.inicio)}`,
    `DTEND:${utcCompacto(evento.fim)}`,
    `SUMMARY:${escapar(evento.titulo)}`,
    `DESCRIPTION:${escapar(evento.descricao)}`,
    ...(evento.local ? [`LOCATION:${escapar(evento.local)}`, `URL:${evento.local}`] : []),
    'BEGIN:VALARM',
    'TRIGGER:-PT10M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Demonstração Takeat em 10 minutos',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `${linhas.map(dobrar).join('\r\n')}\r\n`
}
