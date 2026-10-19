# Takeat — Agenda Site (`rpatakeat-coder/agenda`)

Repositório público/privado oficial da aplicação web de agendamento da **Takeat**.
Permite que leads qualificados (vindos do WhatsApp/SDR, campanhas, inbound ou e-mail) e clientes agendem, remarquem e cancelem reuniões e demonstrações com o time comercial da Takeat de forma autônoma, rápida e integrada ao Google Agenda e ao Takeat OS.

---

## 1. Visão Geral e Objetivo

- **Produto:** Agenda Site (página de agendamento público e autoatendimento de reuniões da Takeat).
- **Missão:** Oferecer uma experiência de agendamento fluida (mobile-first), com zero atrito, eliminando trocas manuais de mensagens para marcar demonstrações de produto (Inside Sales / Closer / SDR).
- **Ecossistema Takeat:**
  - **Takeat OS:** Fonte da verdade para os vendedores ativos (`sellers`), regras de distribuição e credenciais de integração (`AGENDA_DO_DIA_TOKEN`, `AGENDA_EVENTOS_TOKEN`).
  - **Nova IA SDR:** Agente de prospecção e qualificação no WhatsApp que envia o link personalizado da agenda para os leads.
  - **Google Agenda (Google Calendar):** Onde os eventos com Google Meet são efetivamente criados, atualizados ou cancelados.
  - **HubSpot CRM:** Registro das atividades, conversão de reuniões e sincronização de dados do lead.

---

## 2. Regras de Negócio e Comportamento

### 2.1. Disponibilidade e Slots
- **Privacidade absoluta:** Nunca expor títulos, descrições ou participantes dos compromissos existentes dos vendedores. O frontend recebe exclusivamente os blocos de horário livres/ocupados (`disponivel: true/false`, início e fim).
- **Regras de expediente:**
  - Horário comercial padrão do time (ex.: 09h às 18h, segunda a sexta).
  - Bloqueio de horário de almoço e feriados nacionais/locais.
  - Duração padrão da reunião: 30 a 45 minutos (configurável por tipo de reunião / evento).
  - Buffer entre reuniões: mínimo de 10 a 15 minutos entre slots consecutivos.
  - Antecedência mínima: não permitir agendamento para daqui a menos de 2 a 4 horas (evita surpresa para o vendedor).
  - Janela máxima de agendamento: máximo de 14 dias úteis no futuro.
- **Fuso Horário:** Todo o backend processa em UTC / `America/Sao_Paulo`. A interface deve detectar o timezone do usuário e exibir os horários convertidos com clareza.

### 2.2. Distribuição de Reuniões (Roleta / Round-Robin)
- O agendamento pode ser:
  1. **Direcionado (vendedor específico):** Quando a URL contém o slug/id do vendedor (ex.: `/agenda/joao-silva` ou `?seller=...`).
  2. **Distribuído (roleta de vendas):** A reunião é roteada para o vendedor elegível mais apto segundo as regras do Takeat OS (distribuição percentual ou quem está mais abaixo da meta nos últimos 30 dias).
- Somente vendedores ativos, com agenda Google conectada e com permissão válida para criar reuniões recebem eventos.

### 2.3. Criação, Remarcação e Cancelamento
- **Criação:**
  - Validação estrita de e-mail e telefone (formato E.164 para WhatsApp).
  - Reunião sempre criada com convite para: `lead_email` + `vendedor_email`.
  - Link do Google Meet gerado automaticamente.
  - Gravação de metadados: origem do tráfego (`utm_*`), `lead_id`, canal de origem (`whatsapp_sdr`, `site`, etc.).
- **Remarcação:**
  - Reagendamento sempre prioriza o **mesmo vendedor** original.
  - Caso o mesmo vendedor não tenha agenda nos próximos dias, oferecer transferência com confirmação explícita do lead.
  - Atualização direta do evento no Google Calendar para manter o mesmo histórico e link do Meet sempre que possível.
- **Cancelamento:**
  - Cancelamento com motivo registrado (desistência, imprevisto, timing errado).
  - Liberação imediata do slot na agenda do vendedor.

### 2.4. Idempotência e Segurança
- **Chamadas à API:** Criações de evento devem possuir chave de idempotência ou trava para impedir que cliques duplos do lead gerem 2 eventos no Google Agenda.
- **Proteção contra Abuso:** Rate limit estrito por IP e por telefone/e-mail para evitar preenchimento automatizado e sequestro de horários de vendedores.
- **Segredos:** Nenhuma chave com permissão de escrita ou token de serviço do Takeat OS / Google Calendar deve estar acessível no cliente (browser). Qualquer integração de escrita deve passar por rotas de backend (API Routes / Edge Functions).

---

## 3. Padrões Visuais (Takeat Design System)

A interface deve seguir rigorosamente a identidade visual da **Takeat**:

### 3.1. Cores Principais
- **Brand / Ação Principal:** `#C8131B` (Takeat Red 500)
  - Hover: `#94090F` (Brand 600)
  - Fundo sutil / Badge: `#FDF3F4` (Brand 50)
- **Sucesso / Confirmado:** `#2EC9B7` (Success 500)
  - Hover / Dark: `#1D9688` (Success 600)
- **Atenção / Aviso:** `#FFB32F` (Warning 500)
- **Informação / Foco:** `#01AFFF` (Info 500)

### 3.2. Neutros e Superfícies (Suporte a Tema Claro e Escuro)
- **Tema Claro:**
  - `canvas` (fundo principal): `#F6F6F6`
  - `surface` (cards, modais): `#FFFFFF`
  - `ink-900` (títulos, texto forte): `#222222`
  - `ink-700` (texto de corpo): `#454545`
  - `ink-500` (texto secundário/labels): `#7A7A7A`
  - `ink-300` (bordas de input, divisores): `#C6C6C6`
- **Tema Escuro:**
  - `canvas`: `#121212`
  - `surface`: `#1E1E1E`
  - `ink-900`: `#EDEDED`
  - `ink-700`: `#DDDDDD`
  - `ink-500`: `#969696`
  - `ink-300`: `#2A2A2A`
- **Regra:** Usar cinza neutro puro (sem tons azulados desnecessários no fundo neutro).

### 3.3. Experiência do Usuário (UX)
- **Mobile First:** A maioria dos usuários acessa pelo smartphone via link recebido no WhatsApp. Botões grandes de toque (mínimo 44px de altura), tipografia legível e sem layout quebrado.
- **Etapas Claras:**
  1. Escolha da data (calendário interativo).
  2. Escolha do horário disponível (slots em grade ou lista rápida).
  3. Identificação rápida (se vier com parâmetros de URL `?name=...&email=...&phone=...`, pré-preencher os campos).
  4. Confirmação instantânea com resumo, botão "Adicionar ao Google Agenda / Apple Calendar" e instruções do Meet.
- **Micro-interações:** Animações de transição suaves (200–300ms) ao trocar de data ou confirmar agendamento. Feedback visual claro de carregamento (`skeleton loading` ou spinner da marca).

---

## 4. Stack Tecnológica e Convenções de Código

- **Linguagem:** TypeScript (estrito, `noImplicitAny: true`).
- **Frontend:** React / Next.js ou Vite, com componentes modulares e acessíveis.
- **Estilização:** CSS moderno / Tailwind CSS ou CSS Modules respeitando os tokens do Takeat Design System.
- **Validação de Dados:** Zod para validação de formulários e payloads de API.
- **Testes:** Vitest para testes unitários de lógica de slots, fusos e regras de agendamento.
- **Qualidade de Código:** Biome ou ESLint + Prettier. Sem `console.log` esquecidos em produção.
- **Internacionalização:** Todos os textos voltados para o usuário final devem estar em Português do Brasil (`pt-BR`).

---

## 5. Como Trabalhar no Repositório

### 5.1. Comandos Comuns
```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev

# Executar checagem de tipos e lint
npm run check # ou npm run lint && npx tsc --noEmit

# Executar testes unitários
npm run test

# Build de produção
npm run build
```

### 5.2. Padrão de Commits e Git
- Commits semânticos no padrão Conventional Commits:
  - `feat: adiciona seleção de fusos horários no calendário`
  - `fix: corrige verificação de conflitos entre slots consecutivos`
  - `style: atualiza tokens de cores para o Takeat Design System`
  - `test: adiciona cobertura para regra de antecedência mínima`
- Trabalhe sempre em branches descritivas (`feature/nome-da-feature`, `fix/descricao-do-bug`).
- Antes do push: garanta que o build e os testes passem localmente.

---

## 6. Diretrizes Específicas para Claude

1. **Contexto de Negócio:** Você está programando o site público de agendamento da Takeat. Priorize sempre alta conversão, agilidade para o lead e confiabilidade de dados.
2. **Segurança Primeiro:** Nunca permita que regras de autorização ou segredos de API fiquem expostos no frontend.
3. **Fidelidade ao Design System:** Siga os tokens de cores, raios de borda e neutros definidos neste arquivo. Evite bibliotecas de componentes genéricas não customizadas.
4. **Respostas em Português:** Mantenha comunicações, documentações internas e mensagens de commit em Português do Brasil.
