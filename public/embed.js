/*!
 * Takeat Agenda — embed para o site (estilo Calendly).
 *
 * Inline:
 *   <div data-takeat-agenda></div>
 *   <script src="https://agenda.takeat.app/embed.js" async></script>
 *
 * Popup (qualquer botão ou link):
 *   <button data-takeat-agenda-popup>Agendar demonstração</button>
 *
 * Atributos opcionais (nos dois): data-vendedor="caio-caiado", data-tema="claro|escuro",
 * data-faturamento="Entre 20 e 50 mil", data-mesas="Até 10 mesas", data-name, data-email,
 * data-phone, data-empresa, data-canal. UTMs e lead_id da URL da página são repassados sozinhos.
 *
 * Depois do formulário do site: passe as respostas como estão (firstname, email, phone,
 * nome_do_restaurante, faturamento_contato, quantidade_mesas). Faturamento e mesas decidem o
 * segmento do lead e de quais vendedores é a agenda; o lead só escolhe o horário e confirma, sem
 * digitar os dados de novo:
 *   TakeatAgenda.abrir(valoresDoFormulario)
 *
 * JavaScript: TakeatAgenda.abrir({ vendedor }) · TakeatAgenda.montar(elemento, { vendedor })
 * Conversão: window.addEventListener('takeat-agenda:agendado', (e) => e.detail.inicio)
 *            (e `takeat_agenda_agendado` no dataLayer do Google Tag Manager, se existir).
 */
;(() => {
  if (window.TakeatAgenda?.pronto) return

  const script = document.currentScript ||
    document.querySelector('script[src*="/embed.js"]') || { src: location.href }
  const ORIGEM = new URL(script.src, location.href).origin
  const DA_PAGINA = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'lead_id',
    'name',
    'email',
    'phone',
    'empresa',
    'canal',
    'faturamento',
    'faturamento_contato',
    'mesas',
    'quantidade_mesas',
  ]
  const DO_ELEMENTO = ['tema', 'name', 'email', 'phone', 'empresa', 'canal', 'faturamento', 'mesas']
  // Nomes do formulário do site (propriedades do HubSpot) → nomes da agenda.
  const DO_FORMULARIO = {
    firstname: 'name',
    nome_do_restaurante: 'empresa',
    faturamento_contato: 'faturamento',
    quantidade_mesas: 'mesas',
  }
  const ALTURA_INICIAL = 640

  function montarUrl(recebidas) {
    const opcoes = { ...recebidas }
    for (const [doFormulario, daAgenda] of Object.entries(DO_FORMULARIO)) {
      if (opcoes[doFormulario] && !opcoes[daAgenda]) opcoes[daAgenda] = opcoes[doFormulario]
    }
    const caminho = opcoes.vendedor ? `/${encodeURIComponent(opcoes.vendedor)}` : '/'
    const url = new URL(caminho, ORIGEM)
    const daPagina = new URLSearchParams(location.search)
    for (const chave of DA_PAGINA) {
      const valor = daPagina.get(chave)
      if (valor) url.searchParams.set(chave, valor)
    }
    for (const chave of DO_ELEMENTO) {
      if (opcoes[chave]) url.searchParams.set(chave, opcoes[chave])
    }
    if (!url.searchParams.has('canal')) url.searchParams.set('canal', 'site')
    url.searchParams.set('pagina', location.origin + location.pathname)
    url.searchParams.set('embed', '1')
    return url.toString()
  }

  function criarIframe(opcoes) {
    const iframe = document.createElement('iframe')
    iframe.src = montarUrl(opcoes)
    iframe.title = 'Agendar demonstração com a Takeat'
    iframe.setAttribute('allowtransparency', 'true')
    iframe.style.cssText = `display:block;width:100%;height:${ALTURA_INICIAL}px;border:0;background:transparent;transition:height .2s cubic-bezier(.4,0,.2,1)`
    return iframe
  }

  const opcoesDe = (el) => ({
    vendedor: el.dataset.vendedor,
    tema: el.dataset.tema,
    name: el.dataset.name,
    email: el.dataset.email,
    phone: el.dataset.phone,
    empresa: el.dataset.empresa,
    canal: el.dataset.canal,
    faturamento: el.dataset.faturamento,
    mesas: el.dataset.mesas,
  })

  // ─── Inline ───────────────────────────────────────────────────────────────────────────────────

  function montar(elemento, opcoes) {
    if (!elemento || elemento.dataset.takeatAgendaMontada) return
    elemento.dataset.takeatAgendaMontada = '1'
    elemento.appendChild(criarIframe(Object.assign(opcoesDe(elemento), opcoes)))
  }

  function montarTodos() {
    for (const el of document.querySelectorAll('[data-takeat-agenda]')) montar(el)
  }

  // ─── Popup ────────────────────────────────────────────────────────────────────────────────────

  let aberto = null

  function fechar() {
    if (!aberto) return
    aberto.fundo.remove()
    document.documentElement.style.overflow = aberto.overflow
    document.removeEventListener('keydown', aberto.teclado)
    aberto.foco?.focus?.()
    aberto = null
  }

  function abrir(opcoes) {
    fechar()
    const celular = window.matchMedia('(max-width: 639px)').matches
    const fundo = document.createElement('div')
    fundo.setAttribute('role', 'dialog')
    fundo.setAttribute('aria-modal', 'true')
    fundo.setAttribute('aria-label', 'Agendar demonstração com a Takeat')
    fundo.style.cssText = `position:fixed;inset:0;z-index:2147483000;display:flex;align-items:${celular ? 'stretch' : 'center'};justify-content:center;padding:${celular ? '0' : '24px'};background:rgba(0,0,0,.5);overflow:auto;-webkit-overflow-scrolling:touch`

    const caixa = document.createElement('div')
    caixa.style.cssText = `position:relative;width:100%;max-width:1060px;margin:auto;${celular ? 'min-height:100%;background:#f6f6f6' : ''}`

    const botao = document.createElement('button')
    botao.type = 'button'
    botao.setAttribute('aria-label', 'Fechar')
    botao.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>'
    botao.style.cssText = `position:${celular ? 'fixed' : 'absolute'};top:${celular ? '8px' : '-14px'};right:${celular ? '8px' : '-14px'};z-index:1;display:grid;place-items:center;width:44px;height:44px;border:0;border-radius:50%;background:#fff;color:#222;box-shadow:0 1px 3px rgba(0,0,0,.12),0 4px 12px rgba(0,0,0,.08);cursor:pointer`
    botao.addEventListener('click', fechar)

    caixa.appendChild(botao)
    caixa.appendChild(criarIframe(opcoes || {}))
    fundo.appendChild(caixa)
    fundo.addEventListener('click', (e) => {
      if (e.target === fundo) fechar()
    })

    const teclado = (e) => {
      if (e.key === 'Escape') fechar()
    }
    document.addEventListener('keydown', teclado)
    aberto = {
      fundo,
      teclado,
      foco: document.activeElement,
      overflow: document.documentElement.style.overflow,
    }
    document.documentElement.style.overflow = 'hidden'
    document.body.appendChild(fundo)
    botao.focus()
  }

  document.addEventListener('click', (e) => {
    const gatilho = e.target.closest?.('[data-takeat-agenda-popup]')
    if (!gatilho) return
    e.preventDefault()
    abrir(opcoesDe(gatilho))
  })

  // ─── Mensagens do <iframe> ────────────────────────────────────────────────────────────────────

  const iframeDe = (origem) => {
    for (const f of document.querySelectorAll('iframe')) if (f.contentWindow === origem) return f
    return null
  }

  window.addEventListener('message', (e) => {
    if (e.origin !== ORIGEM || !e.data || typeof e.data.tipo !== 'string') return
    const iframe = iframeDe(e.source)
    if (!iframe) return
    const { tipo } = e.data

    if (tipo === 'takeat-agenda:altura' && typeof e.data.altura === 'number') {
      iframe.style.height = `${Math.max(320, Math.ceil(e.data.altura))}px`
    } else if (tipo === 'takeat-agenda:etapa') {
      const topo = iframe.getBoundingClientRect().top
      if (topo < 0 || topo > window.innerHeight * 0.5)
        iframe.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else if (
      tipo === 'takeat-agenda:agendado' ||
      tipo === 'takeat-agenda:remarcado' ||
      tipo === 'takeat-agenda:cancelado'
    ) {
      const detalhe = { inicio: e.data.inicio, fim: e.data.fim }
      window.dispatchEvent(new CustomEvent(tipo, { detail: detalhe }))
      if (Array.isArray(window.dataLayer))
        window.dataLayer.push({ event: tipo.replace(/[:-]/g, '_'), ...detalhe })
    }
  })

  // ─── Início ───────────────────────────────────────────────────────────────────────────────────

  window.TakeatAgenda = { pronto: true, abrir, fechar, montar }

  function iniciar() {
    montarTodos()
    // Sites em React/Next montam o container depois do script: observa e monta quando aparecer.
    new MutationObserver(montarTodos).observe(document.body, { childList: true, subtree: true })
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar)
  else iniciar()
})()
