// O WhatsApp do vendedor, para o lead falar direto com ele depois de agendar. O número vem do
// cadastro do Takeat OS do jeito que foi digitado lá ("27999998888", "5527…", "(27) 9…"). Puro.

import { mascararTelefone, normalizarTelefone, telefoneValido } from './telefone'

/** O número do cadastro em E.164 (+5527999998888), ou null se não der para usar. */
export function whatsappDoVendedor(bruto: string | null | undefined): string | null {
  const e164 = bruto ? normalizarTelefone(bruto) : ''
  return e164 && telefoneValido(e164) ? e164 : null
}

/** '+5527999998888' → '(27) 99999-8888'; número de fora fica em E.164. */
export const formatarWhatsapp = (e164: string): string =>
  e164.startsWith('+55') ? mascararTelefone(e164.slice(3)) : e164

/** https://wa.me/5527999998888?text=… (a conversa já abre com a mensagem escrita). */
export function linkDoWhatsapp(e164: string, mensagem?: string): string {
  const url = `https://wa.me/${e164.replace(/\D/g, '')}`
  return mensagem ? `${url}?text=${encodeURIComponent(mensagem)}` : url
}
