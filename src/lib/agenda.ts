// A resposta do agenda-do-dia do Takeat OS → os vendedores e os compromissos que ocupam a agenda
// de cada um. Puro (sem rede), para testar.
//
// Regras herdadas do OS (api/_lib/agendaDoDia.js):
//  - só `situacao` 'livre' ou 'ocupado' é agenda confiável. 'sem_agenda', 'agenda_com_erro' e
//    'agenda_desatualizada' querem dizer "não sei" — essa pessoa nunca recebe horário;
//  - só evento com `ocupa_agenda` bloqueia (o OS já desconta "disponível" e convite recusado).
//
// Os títulos dos eventos ficam no servidor: daqui para o navegador só saem início e fim de horários
// livres.

import { z } from 'zod'
import type { VendedorAgenda } from './slots'
import { DIA_MS, instanteBrasilia } from './tempo'

const pessoaSchema = z.object({
  id: z.string(),
  nome: z.string(),
  email: z
    .string()
    .nullish()
    .transform((v) => v ?? ''),
  hubspot_owner_id: z
    .union([z.string(), z.number()])
    .nullish()
    .transform((v) => (v == null ? null : String(v))),
  situacao: z.string(),
  compromissos_no_dia: z.number().int().nonnegative(),
})

const eventoSchema = z.object({
  dono: z.object({ id: z.string() }),
  titulo: z.string().nullish(),
  inicio: z.string(),
  fim: z.string(),
  dia_inteiro: z.boolean(),
  ocupa_agenda: z.boolean(),
})

export const agendaDoDiaSchema = z.object({
  ok: z.literal(true),
  data: z.string(),
  pessoas: z.array(pessoaSchema),
  eventos: z.array(eventoSchema),
})

export type AgendaDoDia = z.infer<typeof agendaDoDiaSchema>
export type PessoaDoTime = AgendaDoDia['pessoas'][number]

const SITUACOES_CONFIAVEIS = new Set(['livre', 'ocupado'])

/** 'Sérgio Lima' → 'sergio-lima' (o formato do link direcionado: /sergio-lima). */
export const slugDoNome = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/**
 * A pessoa casa com o termo? E-mail compara inteiro; nome compara pelo slug, inteiro ou só o
 * começo ('caio' casa com 'Caio Caiado', 'caio-c' não).
 */
export function casaVendedor(pessoa: { nome: string; email: string }, termo: string): boolean {
  const t = termo.trim().toLowerCase()
  if (!t) return false
  if (t.includes('@')) return pessoa.email.toLowerCase() === t
  const slug = slugDoNome(t)
  const nome = slugDoNome(pessoa.nome)
  return slug !== '' && (nome === slug || nome.startsWith(`${slug}-`))
}

export type VendedorResolvido =
  | { pessoa: PessoaDoTime }
  | { erro: 'vendedor_nao_encontrado' | 'vendedor_ambiguo' }

/** O vendedor do link direcionado — precisa ser um só. */
export function resolverVendedor(pessoas: readonly PessoaDoTime[], termo: string): VendedorResolvido {
  const achados = pessoas.filter((p) => casaVendedor(p, termo))
  if (!achados.length) return { erro: 'vendedor_nao_encontrado' }
  if (achados.length > 1) return { erro: 'vendedor_ambiguo' }
  return { pessoa: achados[0] }
}

export interface FiltroVendedores {
  /** AGENDA_VENDEDORES — vazio = todo o time. */
  permitidos: readonly string[]
  /** Link direcionado: só este vendedor (e-mail, de preferência). */
  vendedor?: string | null
  /** Na remarcação, a própria reunião não ocupa a agenda de quem a organiza. */
  ignorar?: { email: string; inicioMs: number; fimMs: number } | null
}

export function vendedoresElegiveis(agenda: AgendaDoDia, filtro: FiltroVendedores): VendedorAgenda[] {
  const inicioDia = instanteBrasilia(agenda.data)
  const { permitidos, vendedor, ignorar } = filtro
  return agenda.pessoas
    .filter((p) => SITUACOES_CONFIAVEIS.has(p.situacao) && p.email)
    .filter((p) => !permitidos.length || permitidos.some((t) => casaVendedor(p, t)))
    .filter((p) => !vendedor || casaVendedor(p, vendedor))
    .map((p) => {
      const propria = ignorar && ignorar.email.toLowerCase() === p.email.toLowerCase() ? ignorar : null
      const ocupado = agenda.eventos
        .filter((e) => e.dono.id === p.id && e.ocupa_agenda)
        .map((e) =>
          e.dia_inteiro
            ? { inicioMs: inicioDia, fimMs: inicioDia + DIA_MS }
            : { inicioMs: Date.parse(e.inicio), fimMs: Date.parse(e.fim) },
        )
        .filter((o) => !(propria && o.inicioMs === propria.inicioMs && o.fimMs === propria.fimMs))
      return { id: p.id, nome: p.nome, email: p.email, compromissosNoDia: p.compromissos_no_dia, ocupado }
    })
}
