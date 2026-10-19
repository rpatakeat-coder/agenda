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
- **Distribuição por segmento:** faturamento e mesas (as respostas do formulário) definem o
  segmento do lead — HIGH, MID ou LOW — e de quais vendedores aparece a agenda (ver abaixo). A regra
  é aplicada no servidor: trocar a URL não abre a agenda de outro vendedor.
- **Link direcionado:** `/lucas-segatto` (slug do nome) ou `?vendedor=email@...` mostra só a agenda
  daquela pessoa (não passa pelo roteamento).
- **Clique duplo:** a tela trava o botão e manda `Idempotency-Key`. O servidor devolve a mesma
  reunião para a mesma chave e recusa o mesmo lead no mesmo horário (`ja_agendado`).
- **WhatsApp do vendedor:** a tela de confirmação mostra "Falar com {vendedor} no WhatsApp" e o
  número, vindos do cadastro do Takeat OS (`users.whatsapp`, devolvido em `vendedor.whatsapp` pelas
  rotas de criar/editar/cancelar). Vendedor sem número cadastrado: o botão não aparece.
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
   `AGENDA_SITE_TOKEN` é o mesmo valor que o servidor do takeat.app usa para chamar `/api/sessoes`.
3. `AGENDA_VENDEDORES` é opcional: vazia, o segmento MID (`'roleta'`) usa todo o time com agenda
   conectada. Rode `npm run diagnostico` para ver quem pode receber reunião (em 19/10/2026, os 13
   com agenda conectada).
4. `AGENDA_EMBED_ORIGENS` e a lista de origens do `<iframe>` são lidas no **build**: mudou, precisa de
   redeploy.
5. Recomendado: uma regra de rate limit no Firewall da Vercel para `POST /api/*` (o limite do código
   é por instância).

## Distribuição por segmento

A distribuição fica em [`src/config/roteamento.ts`](src/config/roteamento.ts), em duas tabelas, a
partir das respostas do formulário do takeat.app (`faturamento_contato` e `quantidade_mesas`):

| Faturamento                        | Mesas                          | Segmento | Vendedores                                            |
| ---------------------------------- | ------------------------------ | -------- | ----------------------------------------------------- |
| Entre 100 e 200 mil, Acima de 200 mil | qualquer                    | **HIGH** | Luiza, Marcelo, Thayrone, Caio, André, Vitor (Vitinho) |
| Entre 50 e 100 mil                 | qualquer                       | **MID**  | todos                                                 |
| Até 20 mil, Entre 20 e 50 mil      | De 10 a 30, Acima de 30        | **MID**  | todos                                                 |
| Até 20 mil, Entre 20 e 50 mil      | Até 10, Não possui mesas       | **LOW**  | Rodrigo, Isabela, Amanda, Gustavo, Maria Eduarda      |

- `SEGMENTO_POR_RESPOSTA`: em que segmento cai cada faixa de faturamento — direto, ou por uma tabela
  de mesas. `VENDEDORES_POR_SEGMENTO`: e-mails do Inside Sales (só eles aparecem) ou `'roleta'` (o time
  de `AGENDA_VENDEDORES`; vazia = todos com agenda conectada). Os testes conferem a configuração
  contra essas regras.
- A agenda **só aparece com as respostas que decidem o segmento**: vindas do formulário do site, da
  URL (`?faturamento=Entre 20 e 50 mil&mesas=Até 10 mesas`, os ids `20k-50k`/`ate-10` ou números
  como `?faturamento=45000&mesas=8`) ou de perguntas na própria página, antes do calendário. As mesas
  só são perguntadas quando o faturamento depende delas (até 50 mil).
- Faturamento e mesas vão para o convite (o vendedor vê; o segmento não vai, porque o lead também lê),
  e faturamento, mesas e segmento vão para o webhook. O link de remarcar guarda as respostas: trocar
  de consultor continua dentro do segmento.
- Tudo em `'roleta'` = distribuição desligada (a página não pergunta nada). Mudou o arquivo → novo deploy.

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
`data-faturamento`, `data-mesas`, `data-name`, `data-email`, `data-phone`, `data-empresa`, `data-canal`. As UTMs e
o `lead_id` da URL da página são repassados sozinhos. Também dá para usar `TakeatAgenda.abrir({ vendedor })` no JS.

### Depois do formulário de contato: sessão (fonte única)

A agenda é a **fonte única** da distribuição: depois do formulário, ela decide o segmento **e o
vendedor** do lead. O site só mostra o que ela devolve — o WhatsApp desse vendedor e a agenda dele —,
então o lead nunca fala com um vendedor e marca com outro, e não responde nada de novo.

```
lead envia o formulário → backend do site (já manda ao HubSpot)
  → POST /api/sessoes na agenda (server-to-server)  → segmento + vendedor + sessão
  → /cadastro-confirmado?sessao=…  → WhatsApp do vendedor + agenda dele (só escolher e confirmar)
```

**1. No backend do site**, ao processar o formulário (onde hoje se escolhe o vendedor):

```ts
const r = await fetch('https://agenda.takeat.app/api/sessoes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-api-token': process.env.AGENDA_SITE_TOKEN },
  body: JSON.stringify(valoresDoFormulario), // como estão: firstname, email, phone, nome_do_restaurante,
}) //                                            faturamento_contato, quantidade_mesas, utm_*, page_uri…
const sessao = await r.json()
// sessao.vendedor.hubspotOwnerId → owner do contato no HubSpot
// redireciona para /cadastro-confirmado?sessao=${sessao.sessao}
```

Resposta (o vendedor escolhido é sempre o mesmo para o mesmo e-mail de lead):

```json
{
  "ok": true,
  "tela": "agenda",                // ou "whatsapp": o segmento não tem horário livre
  "segmento": "low",
  "vendedor": {
    "nome": "Gustavo de Freitas Pinto", "email": "…", "whatsapp": "+55…",
    "whatsappUrl": "https://wa.me/55…?text=…", "hubspotOwnerId": "100461532"
  },
  "primeiroHorario": "2026-10-20T09:00:00-03:00",
  "sessao": "…",                   // vale 7 dias; cifrado (os dados do lead não ficam legíveis)
  "url": "https://agenda.takeat.app/?sessao=…",
  "expiraEm": "…"
}
```

**2. Em `/cadastro-confirmado`**, com o `?sessao=` da URL:

```html
<a href="{vendedor.whatsappUrl}">Falar com {vendedor.nome} no WhatsApp</a>
<div data-takeat-agenda></div>  <!-- o embed.js lê o ?sessao= da página sozinho -->
<script src="https://agenda.takeat.app/embed.js" async></script>
```

Na agenda, o servidor usa o vendedor, as respostas e a origem **da sessão** — o que o navegador
mandar nesses campos é ignorado. Sessão vencida: a agenda volta ao fluxo normal (pergunta o que
faltar).

**Sem sessão** (outras páginas), o embed aceita as respostas do formulário direto — mas aí a decisão
do vendedor fica com a roleta da agenda na hora de agendar:

```js
window.TakeatAgenda?.abrir(valoresDoFormulario) // firstname, email, phone, nome_do_restaurante, …
```

Conversão (Google Ads, Meta…):

```js
window.addEventListener('takeat-agenda:agendado', (e) => {
  // e.detail = { inicio, fim }. Com Google Tag Manager, vira o evento `takeat_agenda_agendado`.
})
```

## Link para o WhatsApp (IA SDR)

```
https://agenda.takeat.app/?name=Teresa&email=teresa@padaria.com&phone=11987654321&empresa=Padaria%20Central&faturamento=45000&lead_id=123&canal=whatsapp_sdr
https://agenda.takeat.app/lucas-segatto?name=Teresa&phone=11987654321
```

Os campos vêm preenchidos; o lead só confere e confirma.

## Webhook (opcional, ex.: n8n → HubSpot)

Com `AGENDA_WEBHOOK_URL`, cada evento chega como `POST` JSON (header `x-webhook-secret` se
`AGENDA_WEBHOOK_SECRET` estiver definido):

```json
{
  "evento": "lead.distribuido | reuniao.agendada | reuniao.remarcada | reuniao.cancelada",
  "reuniao": { "google_id": "…", "titulo": "…", "inicio": "…", "fim": "…", "link_meet": "…" },
  "vendedor": { "id": "…", "nome": "…", "email": "…", "hubspot_owner_id": "…", "whatsapp": "+55…" },
  "lead": { "nome": "…", "email": "…", "telefone": "+55…", "empresa": "…" },
  "faturamento": { "faixa": "20k-50k", "rotulo": "Entre 20 e 50 mil" },
  "mesas": { "faixa": "ate-10", "rotulo": "Até 10 mesas" },
  "segmento": "low",
  "origem": { "canal": "whatsapp_sdr", "lead_id": "…", "utm_source": "…" },
  "gestao_url": "https://agenda.takeat.app/reuniao/…",
  "motivo": "imprevisto", "motivo_texto": "Tive um imprevisto", "detalhe": "…"
}
```

`lead.distribuido` (a sessão aberta pelo formulário do site) traz também `tela`, `primeiro_horario` e
`agenda_url` — dá para o n8n atribuir o owner no HubSpot ou mandar o link da agenda no WhatsApp.

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
src/config/roteamento.ts    quem atende cada faixa de faturamento
src/app/                    páginas (/, /[vendedor], /reuniao/[token]) e rotas /api
src/components/             tela (calendário, horários, formulário, confirmação, gestão)
src/lib/                    regras puras e testadas: slots, tempo, feriados, telefone, schemas (Zod)
src/lib/servidor/           só servidor: cliente do Takeat OS, agendamento, link cifrado, proteção
public/embed.js             script de embed para o site
```
