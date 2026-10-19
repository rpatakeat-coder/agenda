'use client'

import { ArrowLeft, CircleAlert, LoaderCircle, Pencil } from 'lucide-react'
import { type SubmitEvent, useRef, useState } from 'react'
import type { ReuniaoConfirmada, SlotPublico } from '@/lib/contrato'
import type { LeadInicial } from '@/lib/parametros'
import type { FaixaFaturamento } from '@/lib/roteamento'
import { type CampoLead, dadosLeadSchema, type Origem } from '@/lib/schemas'
import { mascararTelefone } from '@/lib/telefone'
import s from './FormularioLead.module.css'
import { novaChave, postar } from './hooks'

const CAMPOS: ReadonlyArray<{
  nome: CampoLead
  rotulo: string
  /** Rótulo no resumo (quando os dados vieram do formulário do site). */
  curto: string
  tipo: 'text' | 'email' | 'tel'
  autoComplete: string
  inputMode?: 'email' | 'tel'
  placeholder: string
}> = [
  {
    nome: 'nome',
    rotulo: 'Seu nome',
    curto: 'Nome',
    tipo: 'text',
    autoComplete: 'name',
    placeholder: 'Como podemos te chamar?',
  },
  {
    nome: 'empresa',
    rotulo: 'Nome do restaurante',
    curto: 'Restaurante',
    tipo: 'text',
    autoComplete: 'organization',
    placeholder: 'Ex.: Cantina da Praça',
  },
  {
    nome: 'email',
    rotulo: 'E-mail',
    curto: 'E-mail',
    tipo: 'email',
    autoComplete: 'email',
    inputMode: 'email',
    placeholder: 'voce@restaurante.com.br',
  },
  {
    nome: 'telefone',
    rotulo: 'WhatsApp',
    curto: 'WhatsApp',
    tipo: 'tel',
    autoComplete: 'tel',
    inputMode: 'tel',
    placeholder: '(11) 98765-4321',
  },
]

type Valores = Record<CampoLead, string>
type Erros = Partial<Record<CampoLead, string>>

interface Props {
  slot: SlotPublico
  inicial: LeadInicial
  vendedor: string | null
  faturamento: FaixaFaturamento | null
  origem: Origem
  onVoltar: () => void
  onConfirmada: (reuniao: ReuniaoConfirmada) => void
  onHorarioIndisponivel: (mensagem: string) => void
}

/** Passo 3: identificação rápida (pré-preenchida pela URL quando o link vem do WhatsApp). */
export function FormularioLead({
  slot,
  inicial,
  vendedor,
  faturamento,
  origem,
  onVoltar,
  onConfirmada,
  onHorarioIndisponivel,
}: Props) {
  const [valores, setValores] = useState<Valores>({
    nome: inicial.nome ?? '',
    empresa: inicial.empresa ?? '',
    email: inicial.email ?? '',
    telefone: inicial.telefone ? mascararTelefone(inicial.telefone) : '',
  })
  // Dados completos vindos do formulário do site: o lead só confirma, sem digitar de novo.
  const [editando, setEditando] = useState(() => !dadosLeadSchema.safeParse(valores).success)
  const [erros, setErros] = useState<Erros>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  // Uma chave por horário escolhido: clique duplo (ou reenvio após queda de rede) não cria 2 eventos.
  const [chave] = useState(novaChave)
  const campos = useRef<Partial<Record<CampoLead, HTMLInputElement | null>>>({})
  const armadilha = useRef<HTMLInputElement>(null)

  function alterar(campo: CampoLead, valor: string) {
    setValores((v) => ({ ...v, [campo]: campo === 'telefone' ? mascararTelefone(valor) : valor }))
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: undefined }))
  }

  async function enviar(evento: SubmitEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (enviando) return
    const lido = dadosLeadSchema.safeParse(valores)
    if (!lido.success) {
      const novos: Erros = {}
      for (const issue of lido.error.issues) {
        const campo = issue.path[0] as CampoLead
        novos[campo] ??= issue.message
      }
      setErros(novos)
      const primeiro = CAMPOS.find((c) => novos[c.nome])
      if (primeiro) campos.current[primeiro.nome]?.focus()
      return
    }

    setEnviando(true)
    setErroGeral(null)
    const resposta = await postar<{ reuniao: ReuniaoConfirmada }>(
      '/api/agendamentos',
      {
        ...lido.data,
        inicio: slot.inicio,
        vendedor: vendedor ?? undefined,
        faturamento: faturamento ?? undefined,
        origem,
        site: armadilha.current?.value || undefined,
      },
      { 'Idempotency-Key': chave },
    )
    setEnviando(false)
    if (resposta.ok) return onConfirmada(resposta.reuniao)
    if (resposta.erro === 'horario_indisponivel') return onHorarioIndisponivel(resposta.mensagem)
    if (resposta.campos) {
      setErros(resposta.campos as Erros)
      setEditando(true)
    }
    setErroGeral(resposta.mensagem)
  }

  return (
    <form className={`${s.formulario} entrar`} noValidate onSubmit={enviar}>
      <div className={s.topo}>
        <button type="button" className="botao botao-fantasma" onClick={onVoltar}>
          <ArrowLeft size={18} aria-hidden /> Voltar
        </button>
      </div>
      <div className={s.cabecalho}>
        <h2 className={s.titulo}>{editando ? 'Seus dados' : 'Confirme o agendamento'}</h2>
        <p className={s.subtitulo}>
          {editando
            ? 'Para enviarmos o convite com o link da reunião.'
            : 'O convite vai para os dados que você já enviou.'}
        </p>
      </div>

      {!editando && (
        <div className={s.resumo}>
          <dl>
            {CAMPOS.map((c) => (
              <div key={c.nome}>
                <dt>{c.curto}</dt>
                <dd>{valores[c.nome]}</dd>
              </div>
            ))}
          </dl>
          <button type="button" className="botao botao-fantasma" onClick={() => setEditando(true)}>
            <Pencil size={16} aria-hidden /> Editar
          </button>
        </div>
      )}

      {editando &&
        CAMPOS.map((c, i) => (
          <div className="campo" key={c.nome}>
            <label htmlFor={`campo-${c.nome}`} className="rotulo">
              {c.rotulo}
            </label>
            <input
              id={`campo-${c.nome}`}
              ref={(el) => {
                campos.current[c.nome] = el
              }}
              name={c.nome}
              className="entrada"
              type={c.tipo}
              inputMode={c.inputMode}
              autoComplete={c.autoComplete}
              autoCapitalize={c.tipo === 'text' ? 'words' : 'off'}
              enterKeyHint={i === CAMPOS.length - 1 ? 'send' : 'next'}
              placeholder={c.placeholder}
              value={valores[c.nome]}
              onChange={(e) => alterar(c.nome, e.target.value)}
              aria-invalid={Boolean(erros[c.nome])}
              aria-describedby={erros[c.nome] ? `erro-${c.nome}` : undefined}
            />
            {erros[c.nome] && (
              <p id={`erro-${c.nome}`} className="erro-campo">
                <CircleAlert size={14} aria-hidden /> {erros[c.nome]}
              </p>
            )}
          </div>
        ))}

      {/* Honeypot: invisível para gente, irresistível para robô. */}
      <div className={s.armadilha} aria-hidden="true">
        <label>
          Site
          <input ref={armadilha} name="site" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {erroGeral && (
        <div role="alert" className={`alerta ${s.largo}`}>
          <CircleAlert size={18} aria-hidden />
          <p>{erroGeral}</p>
        </div>
      )}

      <div className={s.largo}>
        <button type="submit" className="botao botao-primario botao-bloco" disabled={enviando}>
          {enviando ? (
            <>
              <LoaderCircle size={18} className="girando" aria-hidden /> Agendando…
            </>
          ) : (
            'Confirmar agendamento'
          )}
        </button>
        <p className={s.nota}>Você recebe o convite com o link do Google Meet no e-mail informado.</p>
      </div>
    </form>
  )
}
