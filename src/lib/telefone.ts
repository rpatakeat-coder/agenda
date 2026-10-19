// WhatsApp em E.164. O lead digita do jeito brasileiro — "(11) 98765-4321", "11987654321",
// "+55 11 98765-4321" — e a gente guarda "+5511987654321". Número de fora começa com "+".

export const E164 = /^\+[1-9]\d{7,14}$/

/** Normaliza para E.164. Devolve '' quando não dá para entender o número. */
export function normalizarTelefone(bruto: string): string {
  const texto = bruto.trim()
  const digitos = texto.replace(/\D/g, '')
  if (!digitos) return ''
  if (texto.startsWith('+')) return `+${digitos}`
  if (digitos.length === 10 || digitos.length === 11) return `+55${digitos}`
  if (digitos.startsWith('55') && (digitos.length === 12 || digitos.length === 13)) return `+${digitos}`
  // 00 + código do país (discagem internacional).
  if (digitos.startsWith('00')) return `+${digitos.slice(2)}`
  return ''
}

/** E.164 válido; para +55, DDD de 11 a 99 e 8 (fixo) ou 9 dígitos começando com 9 (celular). */
export function telefoneValido(e164: string): boolean {
  if (!E164.test(e164)) return false
  if (!e164.startsWith('+55')) return true
  return /^\+55[1-9][1-9](9\d{8}|[2-8]\d{7})$/.test(e164)
}

/** Máscara enquanto o lead digita: "(11) 98765-4321". Número com "+" fica como está. */
export function mascararTelefone(valor: string): string {
  if (valor.trim().startsWith('+')) return valor
  const d = valor.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}
