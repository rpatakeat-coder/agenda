// Dados que viajam numa URL sem poder ser lidos nem alterados: cifrados (AES-256-GCM) e
// autenticados — mudar um byte invalida o token. Usado no link de remarcar/cancelar e na sessão
// que o formulário do site abre na agenda.
//
// A `finalidade` entra na chave: um token de uma finalidade nunca abre como de outra (o código de
// sessão não serve de link de reunião, e vice-versa). O link de reunião usa a finalidade vazia —
// é a chave de antes, e os links já enviados continuam valendo.
import 'server-only'

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import type { z } from 'zod'

const IV = 12
const TAG = 16

const chave = (segredo: string, finalidade: string): Buffer =>
  createHash('sha256')
    .update(finalidade ? `${finalidade}:${segredo}` : segredo, 'utf8')
    .digest()

export function selar(dados: unknown, segredo: string, finalidade = ''): string {
  const iv = randomBytes(IV)
  const cifra = createCipheriv('aes-256-gcm', chave(segredo, finalidade), iv)
  const cifrado = Buffer.concat([cifra.update(JSON.stringify(dados), 'utf8'), cifra.final()])
  return Buffer.concat([iv, cifra.getAuthTag(), cifrado]).toString('base64url')
}

/** Devolve os dados ou null (token malformado, adulterado, de outro segredo ou outra finalidade). */
export function abrir<T>(token: string, segredo: string, schema: z.ZodType<T>, finalidade = ''): T | null {
  try {
    const bruto = Buffer.from(token, 'base64url')
    if (bruto.length <= IV + TAG) return null
    const decifra = createDecipheriv('aes-256-gcm', chave(segredo, finalidade), bruto.subarray(0, IV))
    decifra.setAuthTag(bruto.subarray(IV, IV + TAG))
    const json = Buffer.concat([decifra.update(bruto.subarray(IV + TAG)), decifra.final()]).toString('utf8')
    const lido = schema.safeParse(JSON.parse(json))
    return lido.success ? lido.data : null
  } catch {
    return null
  }
}
