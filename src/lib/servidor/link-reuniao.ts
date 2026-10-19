// O link de remarcar/cancelar (/reuniao/<token>), como o do Calendly: quem tem o link gerencia a
// reunião. O token é cifrado (AES-256-GCM) — carrega o google_id e os dados do lead, que não
// podem ficar legíveis numa URL — e autenticado: alterar um byte invalida o link.
import 'server-only'

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'

const dadosSchema = z.object({
  /** google_id do evento. */
  g: z.string().min(1),
  /** E-mail e nome do vendedor que organiza. */
  v: z.string().min(1),
  vn: z.string(),
  /** Início e fim quando o link foi gerado (a página confere a situação atual no OS). */
  i: z.string(),
  f: z.string(),
  /** Lead: nome, e-mail, WhatsApp, restaurante — para transferir de consultor sem pedir de novo. */
  l: z.object({ n: z.string(), e: z.string(), t: z.string(), r: z.string() }),
})

export type DadosReuniao = z.infer<typeof dadosSchema>

const IV = 12
const TAG = 16
const chave = (segredo: string): Buffer => createHash('sha256').update(segredo, 'utf8').digest()

export function selarReuniao(dados: DadosReuniao, segredo: string): string {
  const iv = randomBytes(IV)
  const cifra = createCipheriv('aes-256-gcm', chave(segredo), iv)
  const cifrado = Buffer.concat([cifra.update(JSON.stringify(dados), 'utf8'), cifra.final()])
  return Buffer.concat([iv, cifra.getAuthTag(), cifrado]).toString('base64url')
}

/** Devolve os dados ou null (token malformado, adulterado ou de outro segredo). */
export function abrirReuniao(token: string, segredo: string): DadosReuniao | null {
  try {
    const bruto = Buffer.from(token, 'base64url')
    if (bruto.length <= IV + TAG) return null
    const decifra = createDecipheriv('aes-256-gcm', chave(segredo), bruto.subarray(0, IV))
    decifra.setAuthTag(bruto.subarray(IV, IV + TAG))
    const json = Buffer.concat([decifra.update(bruto.subarray(IV + TAG)), decifra.final()]).toString('utf8')
    const lido = dadosSchema.safeParse(JSON.parse(json))
    return lido.success ? lido.data : null
  } catch {
    return null
  }
}
