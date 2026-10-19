'use client'

import {
  ArrowLeft,
  CalendarClock,
  CalendarX2,
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import type { ReuniaoConfirmada, ReuniaoPublica, SlotPublico } from '@/lib/contrato'
import { dataPorExtenso, faixaDeHorario, nomeDoFuso } from '@/lib/formatacao'
import { MOTIVOS_CANCELAMENTO, type MotivoCancelamento } from '@/lib/schemas'
import { Confirmacao, ResumoDaReuniao } from './Confirmacao'
import { Estado } from './Estado'
import s from './GerenciarReuniao.module.css'
import { type ControleDeFuso, postar, useDisponibilidade, useFuso } from './hooks'
import { InfoDaReuniao, Moldura } from './Moldura'
import { avisarSite, mostrarTopo } from './PonteEmbed'
import { SeletorHorario } from './SeletorHorario'

type Modo =
  | { tipo: 'resumo' }
  | { tipo: 'escolher'; transferir: boolean }
  | { tipo: 'confirmar'; slot: SlotPublico; transferir: boolean }
  | { tipo: 'cancelar' }
  | { tipo: 'remarcada'; reuniao: ReuniaoConfirmada }

interface Props {
  token: string
  inicial: ReuniaoPublica | null
  erro: string | null
  duracaoMin: number
}

const novoAgendamento = (
  <a href="/" className="botao botao-primario">
    Agendar novo horário
  </a>
)

/** /reuniao/<token>: o lead remarca (mesmo consultor, ou outro com confirmação) ou cancela. */
export function GerenciarReuniao({ token, inicial, erro, duracaoMin }: Props) {
  const fuso = useFuso()
  const [reuniao, setReuniao] = useState(inicial)
  const [modo, setModo] = useState<Modo>({ tipo: 'resumo' })
  const [aviso, setAviso] = useState<string | null>(null)

  function irPara(novo: Modo) {
    setModo(novo)
    mostrarTopo()
  }

  if (erro || !reuniao)
    return (
      <Moldura>
        <Estado icone={CircleAlert} tom="marca" titulo="Não foi possível abrir sua reunião" texto={erro}>
          {novoAgendamento}
        </Estado>
      </Moldura>
    )

  if (modo.tipo === 'remarcada')
    return (
      <Moldura>
        <Confirmacao reuniao={modo.reuniao} fuso={fuso.atual} titulo="Reunião remarcada!" tipo="remarcado" />
      </Moldura>
    )

  if (reuniao.estado === 'cancelada')
    return (
      <Moldura>
        <Estado
          icone={CalendarX2}
          titulo="Reunião cancelada"
          texto="Quando for um bom momento, é só escolher um novo horário."
        >
          {novoAgendamento}
        </Estado>
      </Moldura>
    )

  if (reuniao.estado === 'encerrada')
    return (
      <Moldura>
        <Estado
          icone={CircleCheck}
          tom="sucesso"
          titulo="Esta reunião já aconteceu"
          texto="Quer conversar de novo com o time da Takeat?"
        >
          {novoAgendamento}
        </Estado>
      </Moldura>
    )

  const emConfirmacao = modo.tipo === 'confirmar'
  const vigente = emConfirmacao ? modo.slot : reuniao
  const transferindo = (modo.tipo === 'escolher' || modo.tipo === 'confirmar') && modo.transferir
  const lateral = (
    <InfoDaReuniao
      duracaoMin={duracaoMin}
      vendedor={transferindo ? null : reuniao.vendedor.nome}
      horario={{
        rotulo: emConfirmacao ? 'Novo horário' : 'Horário atual',
        quando: dataPorExtenso(vigente.inicio, fuso.atual),
        faixa: `${faixaDeHorario(vigente.inicio, vigente.fim, fuso.atual)} · ${nomeDoFuso(fuso.atual)}`,
      }}
    />
  )

  return (
    <Moldura lateral={lateral}>
      {modo.tipo === 'resumo' && (
        <div className={`${s.painel} entrar`}>
          <h2 className={s.titulo}>Sua reunião</h2>
          <ResumoDaReuniao
            inicio={reuniao.inicio}
            fim={reuniao.fim}
            vendedor={reuniao.vendedor.nome}
            linkMeet={reuniao.linkMeet}
            fuso={fuso.atual}
          />
          <div className={s.acoes}>
            <button
              type="button"
              className="botao botao-secundario"
              onClick={() => irPara({ tipo: 'escolher', transferir: false })}
            >
              <CalendarClock size={18} aria-hidden /> Remarcar
            </button>
            <button type="button" className="botao botao-perigo" onClick={() => irPara({ tipo: 'cancelar' })}>
              <CalendarX2 size={18} aria-hidden /> Cancelar reunião
            </button>
          </div>
        </div>
      )}

      {modo.tipo === 'escolher' && (
        <div className={s.painel}>
          <Voltar onClick={() => irPara({ tipo: 'resumo' })} />
          <EscolherNovoHorario
            key={String(modo.transferir)}
            token={token}
            transferir={modo.transferir}
            fuso={fuso}
            aviso={aviso}
            ocultar={reuniao.inicio}
            vendedor={reuniao.vendedor.nome}
            onEscolher={(slot) => {
              setAviso(null)
              irPara({ tipo: 'confirmar', slot, transferir: modo.transferir })
            }}
            onTransferir={() => irPara({ tipo: 'escolher', transferir: true })}
          />
        </div>
      )}

      {modo.tipo === 'confirmar' && (
        <ConfirmarRemarcacao
          token={token}
          reuniao={reuniao}
          slot={modo.slot}
          transferir={modo.transferir}
          fuso={fuso.atual}
          onVoltar={() => irPara({ tipo: 'escolher', transferir: modo.transferir })}
          onRemarcada={(r) => irPara({ tipo: 'remarcada', reuniao: r })}
          onHorarioIndisponivel={(mensagem) => {
            setAviso(mensagem)
            irPara({ tipo: 'escolher', transferir: modo.transferir })
          }}
          onFimDaReuniao={setReuniao}
        />
      )}

      {modo.tipo === 'cancelar' && (
        <Cancelar
          token={token}
          onVoltar={() => irPara({ tipo: 'resumo' })}
          onCancelada={(r) => {
            setReuniao(r)
            avisarSite({ tipo: 'takeat-agenda:cancelado' })
            mostrarTopo()
          }}
        />
      )}
    </Moldura>
  )
}

function Voltar({ onClick }: { onClick: () => void }) {
  return (
    <div className={s.voltar}>
      <button type="button" className="botao botao-fantasma" onClick={onClick}>
        <ArrowLeft size={18} aria-hidden /> Voltar
      </button>
    </div>
  )
}

function EscolherNovoHorario(props: {
  token: string
  transferir: boolean
  fuso: ControleDeFuso
  aviso: string | null
  ocultar: string
  vendedor: string
  onEscolher: (slot: SlotPublico) => void
  onTransferir: () => void
}) {
  const { estado, recarregar } = useDisponibilidade({
    reuniao: props.token,
    transferir: props.transferir ? '1' : null,
  })
  return (
    <SeletorHorario
      estado={estado}
      fuso={props.fuso}
      aviso={props.aviso}
      titulo={props.transferir ? 'Horários com outros consultores' : `Novo horário com ${props.vendedor}`}
      ocultar={props.transferir ? null : props.ocultar}
      onEscolher={props.onEscolher}
      onRecarregar={recarregar}
      vazio={
        !props.transferir && (
          <button type="button" className="botao botao-secundario" onClick={props.onTransferir}>
            <Users size={18} aria-hidden /> Ver horários com outro consultor
          </button>
        )
      }
    />
  )
}

function ConfirmarRemarcacao(props: {
  token: string
  reuniao: ReuniaoPublica
  slot: SlotPublico
  transferir: boolean
  fuso: string
  onVoltar: () => void
  onRemarcada: (r: ReuniaoConfirmada) => void
  onHorarioIndisponivel: (mensagem: string) => void
  onFimDaReuniao: (r: ReuniaoPublica) => void
}) {
  const { reuniao, slot, transferir, fuso } = props
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function confirmar() {
    if (enviando) return
    setEnviando(true)
    setErro(null)
    const r = await postar<{ reuniao: ReuniaoConfirmada }>(`/api/reunioes/${props.token}/remarcar`, {
      inicio: slot.inicio,
      transferir,
    })
    setEnviando(false)
    if (r.ok) return props.onRemarcada(r.reuniao)
    if (r.erro === 'horario_indisponivel') return props.onHorarioIndisponivel(r.mensagem)
    if (r.erro === 'reuniao_cancelada') return props.onFimDaReuniao({ ...reuniao, estado: 'cancelada' })
    if (r.erro === 'reuniao_encerrada') return props.onFimDaReuniao({ ...reuniao, estado: 'encerrada' })
    setErro(r.mensagem)
  }

  return (
    <div className={`${s.painel} entrar`}>
      <Voltar onClick={props.onVoltar} />
      <h2 className={s.titulo}>Confirmar novo horário</h2>
      <dl className={s.troca}>
        <div>
          <dt>De</dt>
          <dd className={s.antigo}>
            {dataPorExtenso(reuniao.inicio, fuso)}, {faixaDeHorario(reuniao.inicio, reuniao.fim, fuso)}
          </dd>
        </div>
        <div>
          <dt>Para</dt>
          <dd className={s.novo}>
            {dataPorExtenso(slot.inicio, fuso)}, {faixaDeHorario(slot.inicio, slot.fim, fuso)}
          </dd>
        </div>
      </dl>
      {transferir ? (
        <div className="alerta alerta-aviso">
          <CircleAlert size={18} aria-hidden />
          <p>
            A reunião passa para outro consultor da Takeat: você recebe um convite novo e a reunião com{' '}
            {reuniao.vendedor.nome} é cancelada.
          </p>
        </div>
      ) : (
        <p className={s.texto}>
          Continua com {reuniao.vendedor.nome}, no mesmo link do Google Meet. Você recebe a atualização no
          e-mail.
        </p>
      )}
      {erro && (
        <div role="alert" className="alerta">
          <CircleAlert size={18} aria-hidden />
          <p>{erro}</p>
        </div>
      )}
      <button
        type="button"
        className="botao botao-primario botao-bloco"
        disabled={enviando}
        onClick={confirmar}
      >
        {enviando ? (
          <>
            <LoaderCircle size={18} className="girando" aria-hidden /> Remarcando…
          </>
        ) : transferir ? (
          'Confirmar com outro consultor'
        ) : (
          'Confirmar novo horário'
        )}
      </button>
    </div>
  )
}

function Cancelar(props: { token: string; onVoltar: () => void; onCancelada: (r: ReuniaoPublica) => void }) {
  const [motivo, setMotivo] = useState<MotivoCancelamento | null>(null)
  const [detalhe, setDetalhe] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function cancelar() {
    if (enviando) return
    if (!motivo) return setErro('Escolha um motivo para cancelar.')
    setEnviando(true)
    setErro(null)
    const r = await postar<{ reuniao: ReuniaoPublica }>(`/api/reunioes/${props.token}/cancelar`, {
      motivo,
      detalhe: detalhe.trim() || undefined,
    })
    setEnviando(false)
    if (r.ok) return props.onCancelada(r.reuniao)
    setErro(r.mensagem)
  }

  return (
    <div className={`${s.painel} entrar`}>
      <Voltar onClick={props.onVoltar} />
      <div className={s.cabecalho}>
        <h2 className={s.titulo}>Cancelar reunião</h2>
        <p className={s.texto}>Conta pra gente o motivo — ajuda o time a melhorar.</p>
      </div>
      <fieldset className={s.motivos}>
        <legend className="sr-only">Motivo do cancelamento</legend>
        {(Object.entries(MOTIVOS_CANCELAMENTO) as [MotivoCancelamento, string][]).map(([valor, rotulo]) => (
          <label key={valor} className={`${s.motivo} ${motivo === valor ? s.motivoAtivo : ''}`}>
            <input
              type="radio"
              name="motivo"
              value={valor}
              checked={motivo === valor}
              onChange={() => {
                setMotivo(valor)
                setErro(null)
              }}
            />
            {rotulo}
          </label>
        ))}
      </fieldset>
      <div className="campo">
        <label htmlFor="detalhe" className="rotulo">
          Quer contar mais? <span className={s.opcional}>(opcional)</span>
        </label>
        <textarea
          id="detalhe"
          className="entrada"
          maxLength={500}
          value={detalhe}
          onChange={(e) => setDetalhe(e.target.value)}
        />
      </div>
      {erro && (
        <div role="alert" className="alerta">
          <CircleAlert size={18} aria-hidden />
          <p>{erro}</p>
        </div>
      )}
      <button
        type="button"
        className="botao botao-primario botao-bloco"
        disabled={enviando}
        onClick={cancelar}
      >
        {enviando ? (
          <>
            <LoaderCircle size={18} className="girando" aria-hidden /> Cancelando…
          </>
        ) : (
          'Cancelar reunião'
        )}
      </button>
    </div>
  )
}
