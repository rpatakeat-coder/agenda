'use client'

import {
  CalendarDays,
  CalendarPlus,
  CircleCheck,
  Clock,
  Download,
  MessageCircle,
  User,
  Video,
} from 'lucide-react'
import { useEffect } from 'react'
import { linkGoogleAgenda } from '@/lib/calendario-externo'
import type { ReuniaoConfirmada } from '@/lib/contrato'
import { primeiroNome } from '@/lib/convite'
import { dataPorExtenso, faixaDeHorario, horaNoFuso, nomeDoFuso } from '@/lib/formatacao'
import { FUSO_BRASILIA } from '@/lib/tempo'
import { formatarWhatsapp, linkDoWhatsapp } from '@/lib/whatsapp'
import s from './Confirmacao.module.css'
import { avisarSite } from './PonteEmbed'

interface ResumoProps {
  inicio: string
  fim: string
  vendedor: string
  linkMeet: string | null
  fuso: string
}

export function ResumoDaReuniao({ inicio, fim, vendedor, linkMeet, fuso }: ResumoProps) {
  return (
    <ul className={s.resumo}>
      <li>
        <CalendarDays size={18} aria-hidden />
        <span className={s.forte}>{dataPorExtenso(inicio, fuso)}</span>
      </li>
      <li>
        <Clock size={18} aria-hidden />
        <span>
          {faixaDeHorario(inicio, fim, fuso)} · {nomeDoFuso(fuso)}
        </span>
      </li>
      <li>
        <User size={18} aria-hidden />
        <span>com {vendedor}</span>
      </li>
      <li>
        <Video size={18} aria-hidden />
        {linkMeet ? (
          <a href={linkMeet} target="_blank" rel="noopener noreferrer" className={s.link}>
            {linkMeet.replace(/^https?:\/\//, '')}
          </a>
        ) : (
          <span>Link do Google Meet no convite</span>
        )}
      </li>
    </ul>
  )
}

interface Props {
  reuniao: ReuniaoConfirmada
  fuso: string
  titulo?: string
  tipo?: 'agendado' | 'remarcado'
}

/** Passo 4: confirmação, adicionar à agenda e como entrar no Meet. */
export function Confirmacao({ reuniao, fuso, titulo = 'Reunião confirmada!', tipo = 'agendado' }: Props) {
  useEffect(() => {
    avisarSite({ tipo: `takeat-agenda:${tipo}`, inicio: reuniao.inicio, fim: reuniao.fim })
  }, [tipo, reuniao.inicio, reuniao.fim])

  const token = reuniao.gestaoUrl.split('/reuniao/')[1] ?? ''
  const google = linkGoogleAgenda({
    titulo: reuniao.titulo,
    inicio: reuniao.inicio,
    fim: reuniao.fim,
    descricao: [
      `Demonstração da Takeat com ${reuniao.vendedor.nome}.`,
      reuniao.linkMeet ? `Google Meet: ${reuniao.linkMeet}` : '',
      `Remarcar ou cancelar: ${reuniao.gestaoUrl}`,
    ]
      .filter(Boolean)
      .join('\n\n'),
    local: reuniao.linkMeet,
  })

  return (
    <div className={`${s.confirmacao} entrar`}>
      <div className={s.cabecalho}>
        <span className={s.selo}>
          <CircleCheck size={32} aria-hidden />
        </span>
        <h2 className={s.titulo}>{titulo}</h2>
        <p>
          Enviamos o convite para <strong className={s.forte}>{reuniao.emailLead}</strong>.
        </p>
      </div>

      <ResumoDaReuniao
        inicio={reuniao.inicio}
        fim={reuniao.fim}
        vendedor={reuniao.vendedor.nome}
        linkMeet={reuniao.linkMeet}
        fuso={fuso}
      />

      {reuniao.vendedor.whatsapp && (
        <FalarNoWhatsapp
          whatsapp={reuniao.vendedor.whatsapp}
          vendedor={reuniao.vendedor.nome}
          inicio={reuniao.inicio}
        />
      )}

      <section className={s.secao} aria-labelledby="adicionar">
        <h3 id="adicionar" className={s.subtitulo}>
          Adicionar à sua agenda
        </h3>
        <div className={s.botoes}>
          <a href={google} target="_blank" rel="noopener noreferrer" className="botao botao-secundario">
            <CalendarPlus size={18} aria-hidden /> Google Agenda
          </a>
          <a href={`/api/reunioes/${token}/convite.ics`} className="botao botao-secundario" download>
            <Download size={18} aria-hidden /> Apple / Outlook
          </a>
        </div>
        <p className={s.dica}>Usa Gmail? O convite já aparece sozinho na sua agenda.</p>
      </section>

      <section className={s.secao} aria-labelledby="como-entrar">
        <h3 id="como-entrar" className={s.subtitulo}>
          Como entrar na reunião
        </h3>
        <p>
          No horário, abra o link do Google Meet que está no convite. No computador, funciona direto no
          navegador; no celular, pelo app Google Meet.
        </p>
      </section>

      <p className={s.rodape}>
        Precisa remarcar ou cancelar?{' '}
        <a href={reuniao.gestaoUrl} target="_blank" rel="noopener" className={s.link}>
          Gerenciar reunião
        </a>
      </p>
    </div>
  )
}

/**
 * O WhatsApp do vendedor (do cadastro do Takeat OS), para o lead falar direto com ele. A conversa
 * abre com a mensagem pronta, no horário de Brasília — o do vendedor.
 */
function FalarNoWhatsapp({
  whatsapp,
  vendedor,
  inicio,
}: {
  whatsapp: string
  vendedor: string
  inicio: string
}) {
  const nome = primeiroNome(vendedor)
  const mensagem =
    `Olá, ${nome}! Agendei a demonstração da Takeat para ` +
    `${dataPorExtenso(inicio, FUSO_BRASILIA)}, às ${horaNoFuso(inicio, FUSO_BRASILIA)}.`
  return (
    <section className={s.secao} aria-labelledby="whatsapp-vendedor">
      <h3 id="whatsapp-vendedor" className={s.subtitulo}>
        Fale direto com {nome}
      </h3>
      <a
        href={linkDoWhatsapp(whatsapp, mensagem)}
        target="_blank"
        rel="noopener noreferrer"
        className={`botao botao-secundario ${s.whatsapp}`}
      >
        <MessageCircle size={18} aria-hidden /> Falar com {nome} no WhatsApp
      </a>
      <p className={s.dica}>
        WhatsApp: <span className={s.numero}>{formatarWhatsapp(whatsapp)}</span>
      </p>
    </section>
  )
}
