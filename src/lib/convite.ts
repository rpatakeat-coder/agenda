// Título e texto do convite do Google. O convite sai do e-mail do vendedor, e o lead é convidado:
// os dois leem este texto. Puro, para testar.

import type { DadosLead } from './schemas'

/** Tira o que o Google poderia ler como marcação ou controle (o texto vem do formulário). */
const limpar = (texto: string): string =>
  texto
    // biome-ignore lint/suspicious/noControlCharactersInRegex: é justamente para remover controle.
    .replace(/[<>\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const primeiroNome = (nome: string): string => limpar(nome).split(' ')[0] ?? ''

export const tituloDoConvite = (base: string, lead: Pick<DadosLead, 'empresa' | 'nome'>): string =>
  `${base} — ${limpar(lead.empresa) || limpar(lead.nome)}`.slice(0, 200)

export function descricaoDoConvite(lead: DadosLead, vendedorNome: string, linkDeGestao?: string): string {
  const linhas = [
    `Olá, ${primeiroNome(lead.nome)}! Esta é a sua demonstração da Takeat com ${vendedorNome}.`,
    'No horário marcado, é só entrar pelo link do Google Meet deste convite.',
  ]
  if (linkDeGestao) linhas.push('', `Precisa remarcar ou cancelar? ${linkDeGestao}`)
  linhas.push(
    '',
    '—',
    `Restaurante: ${limpar(lead.empresa)}`,
    `Contato: ${limpar(lead.nome)}`,
    `WhatsApp: ${lead.telefone}`,
    `E-mail: ${lead.email}`,
    '',
    'Agendado pelo site da Takeat.',
  )
  return linhas.join('\n').slice(0, 5000)
}
