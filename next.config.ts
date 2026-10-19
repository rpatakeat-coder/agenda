import type { NextConfig } from 'next'

// Quem pode colocar a agenda num <iframe>: o próprio site, takeat.app (e subdomínios) e as origens
// extras de AGENDA_EMBED_ORIGENS. Qualquer outro site é bloqueado pelo navegador.
const origensDoEmbed = [
  "'self'",
  'https://takeat.app',
  'https://*.takeat.app',
  ...(process.env.AGENDA_EMBED_ORIGENS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
]

const config: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:caminho*',
        headers: [
          { key: 'Content-Security-Policy', value: `frame-ancestors ${origensDoEmbed.join(' ')}` },
          // Só a origem vai em links externos: o token de /reuniao/<token> não vaza para o Meet.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      {
        source: '/embed.js',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=300, stale-while-revalidate=86400' }],
      },
    ]
  },
}

export default config
