# Takeat — Agenda Site

Página pública de agendamento de demonstrações da Takeat, no estilo Calendly: o lead escolhe dia e
horário, informa os dados e recebe o convite do Google Agenda com link do Meet. Pode ser embutida no
site (takeat.app) ou aberta direto pelo link que a IA SDR manda no WhatsApp.

## Como funciona

```
navegador ──► /api/disponibilidade ──► Takeat OS: agenda-do-dia (1 por dia da janela, cache 60 s)
          ──► /api/agendamentos    ──► agenda-do-dia (fresco) ──► agenda-criar-evento
          ──► /api/reunioes/<token>/remarcar | cancelar ──► agenda-editar-evento | agenda-cancelar-evento
```

- **Privacidade:** o servidor lê os eventos do time e calcula os horários livres. Para o navegador só
  saem `inicio`/`fim` de horários livres, nunca título, convidado ou e-mail de compromisso.
- **Tokens** (`AGENDA_DO_DIA_TOKEN`, `AGENDA_EVENTOS_TOKEN`) só existem no servidor.
- **Regras:** expediente, almoço, feriados nacionais + extras, buffer entre reuniões, antecedência
  mínima e janela de N dias úteis (ver `.env.example`). Só entra quem tem agenda confiável no OS
  (`situacao` livre/ocupado); `sem_agenda`, `agenda_com_erro` e `agenda_desatualizada` nunca recebem.
- **Roleta:** um horário aparece se pelo menos um vendedor estiver livre. Ao criar, o site confere a
  agenda fresca e tenta os vendedores livres em ordem (menos compromissos no dia primeiro), sempre
  com `vendedor` explícito. Se o OS recusa um (sem permissão de criar, ocupado), tenta o próximo.
- **Link direcionado:** `/lucas-segatto` (slug do nome) ou `?vendedor=email@...` mostra só a agenda
  daquela pessoa.
- **Clique duplo:** a tela trava o botão e manda `Idempotency-Key`. O servidor devolve a mesma
  reunião para a mesma chave e recusa o mesmo lead no mesmo horário (`ja_agendado`).
- **Remarcar/cancelar:** o convite e a tela de confirmação levam um link `/reuniao/<token>`
  (cifrado com AES-GCM, ninguém lê nem altera). Remarcar mantém o vendedor e o link do Meet. Se ele
  não tiver horário, o lead pode escolher outro consultor (com confirmação explícita): o site cria a
  nova reunião e só então cancela a antiga. Cancelar pede o motivo.

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # preencher tokens e AGENDA_LINK_SECRET (openssl rand -hex 32)
npm run dev                  # http://localhost:3000
npm run check                # Biome + TypeScript
npm test                     # Vitest (regras de horário, fuso, feriados, telefone, token…)
npm run build
```

## Deploy (Vercel)

1. Importar o repositório na Vercel (framework Next.js) e apontar o domínio, ex.: `agenda.takeat.app`.
2. Cadastrar as variáveis de `.env.example` em Production. **Nunca** com prefixo `NEXT_PUBLIC_`.
3. Definir `AGENDA_VENDEDORES` com quem conectou a agenda **com permissão de criar eventos** (em
   07/10/2026: Gustavo, Lucas, Maria Eduarda, Rodrigo, Vitor). Sem a lista, quem só tem leitura entra
   na conta de horários livres e o site perde tentativas recusadas pelo OS.
4. `AGENDA_EMBED_ORIGENS` e a lista de origens do `<iframe>` são lidas no **build**: mudou, precisa de
   redeploy.
5. Recomendado: uma regra de rate limit no Firewall da Vercel para `POST /api/*` (o limite do código
   é por instância).

## Colocar no takeat.app

Inline (o `<iframe>` cresce sozinho com o conteúdo):

```html
<div data-takeat-agenda></div>
<script src="https://agenda.takeat.app/embed.js" async></script>
```

Popup (qualquer botão ou link da página):

```html
<button data-takeat-agenda-popup>Agendar demonstração</button>
<script src="https://agenda.takeat.app/embed.js" async></script>
```

Atributos opcionais nos dois: `data-vendedor="lucas-segatto"`, `data-tema="claro|escuro"`,
`data-name`, `data-email`, `data-phone`, `data-empresa`, `data-canal`. As UTMs e o `lead_id` da URL
da página são repassados sozinhos. Também dá para usar `TakeatAgenda.abrir({ vendedor })` no JS.

Conversão (Google Ads, Meta…):

```js
window.addEventListener('takeat-agenda:agendado', (e) => {
  // e.detail = { inicio, fim }. Com Google Tag Manager, vira o evento `takeat_agenda_agendado`.
})
```

## Link para o WhatsApp (IA SDR)

```
https://agenda.takeat.app/?name=Teresa&email=teresa@padaria.com&phone=11987654321&empresa=Padaria%20Central&lead_id=123&canal=whatsapp_sdr
https://agenda.takeat.app/lucas-segatto?name=Teresa&phone=11987654321
```

Os campos vêm preenchidos; o lead só confere e confirma.

## Webhook (opcional, ex.: n8n → HubSpot)

Com `AGENDA_WEBHOOK_URL`, cada evento chega como `POST` JSON (header `x-webhook-secret` se
`AGENDA_WEBHOOK_SECRET` estiver definido):

```json
{
  "evento": "reuniao.agendada | reuniao.remarcada | reuniao.cancelada",
  "reuniao": { "google_id": "…", "titulo": "…", "inicio": "…", "fim": "…", "link_meet": "…" },
  "vendedor": { "id": "…", "nome": "…", "email": "…", "hubspot_owner_id": "…" },
  "lead": { "nome": "…", "email": "…", "telefone": "+55…", "empresa": "…" },
  "origem": { "canal": "whatsapp_sdr", "lead_id": "…", "utm_source": "…" },
  "gestao_url": "https://agenda.takeat.app/reuniao/…",
  "motivo": "imprevisto", "motivo_texto": "Tive um imprevisto", "detalhe": "…"
}
```

## Limitações conhecidas

- Rate limit e idempotência ficam em memória, por instância da função. A trava pelo título no OS
  cobre clique duplo entre instâncias; para limite estrito, usar o Firewall da Vercel.
- O motivo do cancelamento só sai pelo webhook (a rota de cancelar do OS não tem campo para ele).
- A página `/reuniao/<token>` lê a situação atual com `agenda-cancelar-evento` + `simular: true`:
  no log de integrações do OS isso aparece como "simulação: cancelar".
- Reunião marcada direto no Google aparece aqui em até ~10 min (a cópia do OS). A criação sempre
  reconfere com a agenda fresca.

## Estrutura

```
src/app/                    páginas (/, /[vendedor], /reuniao/[token]) e rotas /api
src/components/             tela (calendário, horários, formulário, confirmação, gestão)
src/lib/                    regras puras e testadas: slots, tempo, feriados, telefone, schemas (Zod)
src/lib/servidor/           só servidor: cliente do Takeat OS, agendamento, link cifrado, proteção
public/embed.js             script de embed para o site
```
