'use client'

import { ArrowLeft, CircleAlert, LoaderCircle } from 'lucide-react'
import { type FormEvent, useRef, useState } from 'react'
import type { ReuniaoConfirmada, SlotPublico } from '@/lib/contrato'
import type { LeadInicial } from '@/lib/parametros'
import { type CampoLead, dadosLeadSchema, type Origem } from '@/lib/schemas'
import { mascararTelefone } from '@/lib/telefone'
import s from './FormularioLead.module.css'
import { novaChave, postar } from './hooks'

const CAMPOS: ReadonlyArray<{
  nome: CampoLead
  rotulo: string
  tipo: 'text' | 'email' | 'tel'
  autoComplete: string
  inputMode?: 'email' | 'tel'
  placeholder: string
}> = [
  {
    nome: 'nome',
    rotulo: 'Seu nome',
    tipo: 'text',
    autoComplete: 'name',
    placeholder: 'Como podemos te chamar?',
  },
  {
    nome: 'empresa',
    rotulo: 'Nome do restaurante',
    tipo: 'text',
    autoComplete: 'organization',
    placeholder: 'Ex.: Cantina da Praça',
  },
  {
    nome: 'email',
    rotulo: 'E-mail',
    tipo: 'email',
    autoComplete: 'email',
    inputMode: 'email',
    placeholder: 'voce@restaurante.com.br',
  },
  {
    nome: 'telefone',
    rotulo: 'WhatsApp',
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

  async function enviar(evento: FormEvent<HTMLFormElement>) {
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
        origem,
        site: armadilha.current?.value || undefined,
      },
      { 'Idempotency-Key': chave },
    )
    setEnviando(false)
    if (resposta.ok) return onConfirmada(resposta.reuniao)
    if (resposta.erro === 'horario_indisponivel') return onHorarioIndisponivel(resposta.mensagem)
    if (resposta.campos) setErros(resposta.campos as Erros)
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
        <h2 className={s.titulo}>Seus dados</h2>
        <p className={s.subtitulo}>Para enviarmos o convite com o link da reunião.</p>
      </div>

      {CAMPOS.map((c, i) => (
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
