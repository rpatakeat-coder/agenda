// Proteção contra abuso e clique duplo. Em memória, por instância da função: segura o grosso
// (rajadas, duplo clique, robô simples). Para limite estrito entre instâncias, somar uma regra de
// rate limit no Firewall da Vercel (ver README).
import 'server-only'

const janelas = new Map<string, number[]>()

/** Registra uma tentativa e diz se ela passou do limite (`limite` por `janelaMs`). */
export function excedeuLimite(chave: string, limite: number, janelaMs: number, agora = Date.now()): boolean {
  const recentes = (janelas.get(chave) ?? []).filter((t) => t > agora - janelaMs)
  const excedeu = recentes.length >= limite
  if (!excedeu) recentes.push(agora)
  janelas.set(chave, recentes)
  if (janelas.size > 10_000) {
    for (const [k, ts] of janelas) if (!ts.some((t) => t > agora - janelaMs)) janelas.delete(k)
  }
  return excedeu
}

export function ipDoPedido(pedido: Request): string {
  const encaminhado = pedido.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return encaminhado || pedido.headers.get('x-real-ip') || 'desconhecido'
}

const execucoes = new Map<string, { expira: number; promessa: Promise<unknown> }>()

/**
 * Idempotência: a mesma chave dentro do prazo devolve o MESMO resultado, sem executar de novo
 * (o segundo clique recebe a reunião criada pelo primeiro). Se falhar, a chave é liberada para
 * uma nova tentativa.
 */
export function executarUmaVez<T>(
  chave: string | null,
  prazoMs: number,
  executar: () => Promise<T>,
): Promise<T> {
  if (!chave) return executar()
  const agora = Date.now()
  const existente = execucoes.get(chave)
  if (existente && existente.expira > agora) return existente.promessa as Promise<T>

  const promessa = executar()
  execucoes.set(chave, { expira: agora + prazoMs, promessa })
  promessa.catch(() => {
    if (execucoes.get(chave)?.promessa === promessa) execucoes.delete(chave)
  })
  if (execucoes.size > 5_000) {
    for (const [k, v] of execucoes) if (v.expira <= agora) execucoes.delete(k)
  }
  return promessa
}
