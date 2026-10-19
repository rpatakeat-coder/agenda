// Cálculo dos horários livres. Puro (sem rede), para testar.
//
// Um horário aparece para o lead quando PELO MENOS UM vendedor elegível está livre nele, com folga
// (buffer) antes e depois em relação aos compromissos que ocupam a agenda dele. Para cada horário
// guardamos quem pode recebê-lo, já na ordem da roleta — o servidor tenta nessa ordem ao criar.

import { ehFeriado } from './feriados'
import { diaDaSemana, instanteBrasilia, MIN_MS, paraHorario, somarDias } from './tempo'

export interface Intervalo {
  inicioMs: number
  fimMs: number
}

export interface RegrasAgenda {
  /** Minutos do dia (Brasília). */
  expediente: { inicio: number; fim: number }
  almoco: { inicio: number; fim: number } | null
  /** 0 = domingo … 6 = sábado. */
  diasDaSemana: readonly number[]
  duracaoMin: number
  /** De quanto em quanto tempo os horários começam. */
  passoMin: number
  /** Folga mínima entre a reunião e outro compromisso do vendedor. */
  bufferMin: number
  /** Não oferecer horário que começa antes de agora + antecedência. */
  antecedenciaMin: number
  janelaDiasUteis: number
  feriadosExtras: ReadonlySet<string>
}

export interface VendedorAgenda {
  id: string
  nome: string
  email: string
  compromissosNoDia: number
  ocupado: Intervalo[]
}

export interface SlotCalculado {
  /** 'HH:MM' em Brasília. */
  horario: string
  inicioMs: number
  fimMs: number
  /** Quem está livre, na ordem em que a roleta tenta. */
  vendedores: VendedorAgenda[]
}

export const diaUtil = (data: string, regras: RegrasAgenda): boolean =>
  regras.diasDaSemana.includes(diaDaSemana(data)) && !ehFeriado(data, regras.feriadosExtras)

/** Os dias úteis em que se pode agendar, a partir de `hoje` (inclusive). */
export function diasDaJanela(hoje: string, regras: RegrasAgenda): string[] {
  const dias: string[] = []
  // Teto de segurança: mesmo com muitos feriados, nunca anda mais que 3× a janela.
  for (let i = 0; dias.length < regras.janelaDiasUteis && i < regras.janelaDiasUteis * 3; i++) {
    const dia = somarDias(hoje, i)
    if (diaUtil(dia, regras)) dias.push(dia)
  }
  return dias
}

const cruza = (a: Intervalo, b: Intervalo): boolean => a.inicioMs < b.fimMs && a.fimMs > b.inicioMs

export function vendedorLivre(vendedor: VendedorAgenda, slot: Intervalo, bufferMin: number): boolean {
  const comFolga = { inicioMs: slot.inicioMs - bufferMin * MIN_MS, fimMs: slot.fimMs + bufferMin * MIN_MS }
  return !vendedor.ocupado.some((o) => cruza(o, comFolga))
}

/**
 * A ordem da roleta: menos compromissos no dia primeiro (a mesma regra do "primeiro livre" do
 * Takeat OS), empate pelo nome.
 */
export const ordenarParaRoleta = (vendedores: readonly VendedorAgenda[]): VendedorAgenda[] =>
  vendedores.toSorted(
    (a, b) => a.compromissosNoDia - b.compromissosNoDia || a.nome.localeCompare(b.nome, 'pt-BR'),
  )

export function calcularSlots(args: {
  data: string
  vendedores: readonly VendedorAgenda[]
  regras: RegrasAgenda
  agoraMs: number
}): SlotCalculado[] {
  const { data, regras, agoraMs } = args
  if (!diaUtil(data, regras) || !args.vendedores.length) return []

  const vendedores = ordenarParaRoleta(args.vendedores)
  const limiteMs = agoraMs + regras.antecedenciaMin * MIN_MS
  const slots: SlotCalculado[] = []
  for (
    let t = regras.expediente.inicio;
    t + regras.duracaoMin <= regras.expediente.fim;
    t += regras.passoMin
  ) {
    const fimMin = t + regras.duracaoMin
    if (regras.almoco && t < regras.almoco.fim && fimMin > regras.almoco.inicio) continue
    const slot = { inicioMs: instanteBrasilia(data, t), fimMs: instanteBrasilia(data, fimMin) }
    if (slot.inicioMs < limiteMs) continue
    const livres = vendedores.filter((v) => vendedorLivre(v, slot, regras.bufferMin))
    if (livres.length) slots.push({ horario: paraHorario(t), ...slot, vendedores: livres })
  }
  return slots
}
