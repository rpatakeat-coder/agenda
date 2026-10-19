import { describe, expect, it, vi } from 'vitest'
import { abrirReuniao, type DadosReuniao, selarReuniao } from '../servidor/link-reuniao'
import { excedeuLimite, executarUmaVez } from '../servidor/protecao'

const SEGREDO = 'x'.repeat(32)
const dados: DadosReuniao = {
  g: '7k2abc',
  v: 'lucas@takeat.app',
  vn: 'Lucas Segatto',
  i: '2026-10-21T09:30:00-03:00',
  f: '2026-10-21T10:00:00-03:00',
  l: { n: 'Teresa', e: 'teresa@padaria.com', t: '+5511987654321', r: 'Padaria Central' },
  fx: '20k-50k',
}

describe('link de remarcar/cancelar', () => {
  it('ida e volta', () => {
    const token = selarReuniao(dados, SEGREDO)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(abrirReuniao(token, SEGREDO)).toEqual(dados)
  })

  it('não deixa os dados do lead legíveis na URL', () => {
    const token = selarReuniao(dados, SEGREDO)
    expect(Buffer.from(token, 'base64url').toString('utf8')).not.toContain('teresa')
  })

  it('recusa token adulterado, de outro segredo ou lixo', () => {
    const token = selarReuniao(dados, SEGREDO)
    const bytes = Buffer.from(token, 'base64url')
    bytes[bytes.length - 1] ^= 1
    expect(abrirReuniao(bytes.toString('base64url'), SEGREDO)).toBeNull()
    expect(abrirReuniao(token, 'y'.repeat(32))).toBeNull()
    expect(abrirReuniao('abc', SEGREDO)).toBeNull()
    expect(abrirReuniao('', SEGREDO)).toBeNull()
  })
})

describe('proteção', () => {
  it('limita tentativas por janela', () => {
    const chave = `teste:${Math.random()}`
    expect(excedeuLimite(chave, 2, 1000, 0)).toBe(false)
    expect(excedeuLimite(chave, 2, 1000, 10)).toBe(false)
    expect(excedeuLimite(chave, 2, 1000, 20)).toBe(true)
    expect(excedeuLimite(chave, 2, 1000, 1500)).toBe(false)
  })

  it('a mesma chave de idempotência não executa duas vezes', async () => {
    const executar = vi.fn(async () => ({ id: 1 }))
    const chave = `idem:${Math.random()}`
    const [a, b] = await Promise.all([
      executarUmaVez(chave, 60_000, executar),
      executarUmaVez(chave, 60_000, executar),
    ])
    expect(executar).toHaveBeenCalledTimes(1)
    expect(a).toBe(b)
  })

  it('falha libera a chave para nova tentativa', async () => {
    const chave = `idem:${Math.random()}`
    await expect(executarUmaVez(chave, 60_000, async () => Promise.reject(new Error('x')))).rejects.toThrow(
      'x',
    )
    await expect(executarUmaVez(chave, 60_000, async () => 'ok')).resolves.toBe('ok')
  })
})
