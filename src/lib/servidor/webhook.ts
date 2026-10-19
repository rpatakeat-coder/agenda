// Webhook opcional (AGENDA_WEBHOOK_URL) — o ponto de saída para o HubSpot (ex.: via n8n): cada
// reunião agendada, remarcada ou cancelada, com lead, vendedor (e o owner do HubSpot), origem/UTM e
// o motivo do cancelamento. Nunca derruba o fluxo do lead: falha só vai para o log.
import 'server-only'

import { configWebhook } from './config'

export type EventoWebhook = 'reuniao.agendada' | 'reuniao.remarcada' | 'reuniao.cancelada'

export async function avisarWebhook(evento: EventoWebhook, dados: Record<string, unknown>): Promise<void> {
  const { url, segredo } = configWebhook()
  if (!url) return
  try {
    const resposta = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(segredo ? { 'x-webhook-secret': segredo } : {}) },
      body: JSON.stringify({ evento, enviado_em: new Date().toISOString(), ...dados }),
      signal: AbortSignal.timeout(8_000),
    })
    if (!resposta.ok) console.error('[webhook]', evento, 'status', resposta.status)
  } catch (e) {
    console.error('[webhook]', evento, e instanceof Error ? e.message : e)
  }
}
