# Takeat — Agenda Site (`rpatakeat-coder/agenda`)

## Visão Geral
Este repositório contém a aplicação web pública e institucional de **Agendamento da Takeat** (`Agenda Site`).
A finalidade deste sistema é fornecer uma interface rápida, responsiva, moderna e intuitiva para que leads e clientes possam agendar reuniões, demonstrações e atendimentos diretamente com o time comercial da Takeat (Inside Sales / SDR / Closers).

A aplicação se integra com o ecossistema Takeat:
- **Takeat OS:** Fonte oficial para gestão de vendedores (`sellers`), regras de roleta e autorizações.
- **Google Agenda (Google Calendar):** Calendários individuais dos vendedores, geração de links de Google Meet e gestão de compromissos.
- **HubSpot & Nova IA SDR:** Rastreamento de conversão de reuniões, atribuição de leads e geração de links personalizados via WhatsApp.

---

## Diretrizes para a IA (Gemini Rules)

1. **Contexto de Domínio:**
   - Mantenha sempre o foco no propósito do **Agenda Site da Takeat**: simplificar o agendamento de reuniões para leads que chegam principalmente via WhatsApp e canais digitais.
   - A experiência do usuário deve ser rápida, com o menor número possível de passos para concluir o agendamento.

2. **Frontend Premium e Design System Takeat:**
   - Priorize um design moderno, limpo e profissional, aderente ao **Takeat Design System**.
   - Assegure suporte completo a **tema claro e tema escuro**, usando neutros puros e as cores oficiais:
     - **Vermelho Takeat (Brand):** `#C8131B` (hover `#94090F`, sutil `#FDF3F4`)
     - **Sucesso (Success):** `#2EC9B7`
     - **Atenção (Warning):** `#FFB32F`
     - **Info (Info):** `#01AFFF`
     - **Neutros Claro:** Fundo `canvas` `#F6F6F6`, cartões `surface` `#FFFFFF`, textos `ink-900` `#222222` / `ink-700` `#454545`.
     - **Neutros Escuro:** Fundo `canvas` `#121212`, cartões `surface` `#1E1E1E`, textos `ink-900` `#EDEDED` / `ink-700` `#DDDDDD`.
   - **Mobile-first:** A maior parte dos acessos provém de smartphones (links de WhatsApp). Botões táteis com área mínima de clique (44px), formulários com teclado apropriado (`inputmode="tel"`, `type="email"`).
   - Use micro-interações fluidas (transições de 200–300ms, feedback imediato de loading e confirmação).

3. **Segurança e Privacidade:**
   - **Privacidade de Agenda:** Nunca trafegue detalhes dos compromissos privados dos vendedores para o navegador do cliente. Apenas slots calculados de disponibilidade (`disponivel`, `inicio`, `fim`) devem ser expostos.
   - **Proteção de Credenciais:** Tokens do Takeat OS (`AGENDA_DO_DIA_TOKEN`, `AGENDA_EVENTOS_TOKEN`) ou credenciais de serviço do Google NUNCA devem estar no código frontend ou expostos em variáveis públicas de ambiente (`VITE_*` ou `NEXT_PUBLIC_*`). Todas as mutações passam por endpoints de servidor / edge functions.
   - **Idempotência:** Requisições de agendamento e cancelamento devem conter mecanismos contra duplo clique (double submit) e rate limiting por IP/contato.

4. **Regras de Negócio de Agendamento:**
   - Respeito rigoroso aos fusos horários (armazenamento e processamento sempre em UTC / `America/Sao_Paulo`).
   - Validação de horários comerciais, intervalos de almoço, antecedência mínima (sem reuniões marcadas para menos de 2h–4h do horário atual) e buffers entre reuniões.
   - Suporte a agendamento com vendedor específico (`?seller=...` ou rota dedicada) ou via roleta distribuída (round-robin configurado no Takeat OS).
   - Pré-preenchimento automático de campos de identificação (nome, e-mail, telefone) caso enviados como parâmetros de consulta na URL.

5. **Padrões de Engenharia e Código:**
   - **TypeScript Estrito:** Tipagem explícita para todas as entidades (Slots, Sellers, Reuniões, Payloads).
   - **Validação de Entrada:** Usar Zod ou equivalente para validar entradas antes de enviar ao backend.
   - **Testes Automatizados:** Cobrir com testes unitários (Vitest / Jest) todas as funções de cálculo de slots disponíveis, fusos e tratamento de feriados.
   - **Internacionalização:** Todos os textos de interface, e-mails de confirmação e mensagens de feedback devem ser redigidos em Português do Brasil (`pt-BR`).

---

## Estrutura Recomendada do Projeto

```text
├── src/
│   ├── components/       # Componentes de UI (Calendário, Grade de Horários, Modal, Form)
│   ├── lib/              # Lógica de negócio (cálculo de slots, timezone, validações)
│   ├── services/         # Clientes de API (Takeat OS, Google Agenda, HubSpot)
│   ├── styles/           # Tokens CSS e variáveis do Takeat Design System
│   └── types/            # Tipos e contratos TypeScript
├── tests/                # Testes unitários e de integração
├── CLAUDE.md             # Instruções e diretrizes para Claude
└── GEMINI.md             # Diretrizes para Gemini e Antigravity IDE
```

---

## Comandos Principais
- `npm run dev`: Inicia o ambiente de desenvolvimento local.
- `npm run build`: Cria a versão otimizada para produção.
- `npm run test`: Executa os testes unitários.
- `npm run check`: Valida tipagem TypeScript e formatação de código.
