// O contrato entre as rotas /api/* e a tela. Nada aqui carrega dado de compromisso de vendedor:
// só horários livres e a reunião do próprio lead.

export interface SlotPublico {
  /** ISO com fuso de Brasília: '2026-10-21T09:30:00-03:00'. */
  inicio: string
  fim: string
}

export interface DiaDisponivel {
  /** 'AAAA-MM-DD' em Brasília. */
  data: string
  slots: SlotPublico[]
}

export interface Disponibilidade {
  duracaoMin: number
  /** Só no link direcionado (ou na remarcação): com quem será a reunião. */
  vendedor: { nome: string } | null
  dias: DiaDisponivel[]
}

export interface ReuniaoConfirmada {
  titulo: string
  inicio: string
  fim: string
  linkMeet: string | null
  vendedor: { nome: string; email: string }
  emailLead: string
  /** Página de remarcar/cancelar (o mesmo link vai no convite). */
  gestaoUrl: string
}

export type EstadoReuniao = 'agendada' | 'cancelada' | 'encerrada'

export interface ReuniaoPublica {
  estado: EstadoReuniao
  titulo: string
  inicio: string
  fim: string
  linkMeet: string | null
  vendedor: { nome: string }
  emailLead: string
}

export const MENSAGENS_DE_ERRO = {
  dados_invalidos: 'Confira os dados informados.',
  horario_indisponivel: 'Esse horário acabou de ser preenchido. Escolha outro, por favor.',
  ja_agendado: 'Você já tem uma reunião marcada nesse horário. Confira o convite no seu e-mail.',
  vendedor_nao_encontrado: 'Não encontramos esse consultor. Confira o link que você recebeu.',
  muitas_tentativas: 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.',
  link_invalido: 'Este link de reunião é inválido.',
  reuniao_cancelada: 'Esta reunião já foi cancelada.',
  reuniao_encerrada: 'Esta reunião já aconteceu.',
  agenda_indisponivel: 'Não conseguimos consultar a agenda agora. Tente de novo em instantes.',
  erro_interno: 'Algo deu errado do nosso lado. Tente de novo em instantes.',
} as const

export type CodigoErro = keyof typeof MENSAGENS_DE_ERRO

export interface RespostaErro {
  ok: false
  erro: CodigoErro
  mensagem: string
  /** Erro por campo do formulário (validação). */
  campos?: Record<string, string>
}

export type Resposta<T> = ({ ok: true } & T) | RespostaErro
