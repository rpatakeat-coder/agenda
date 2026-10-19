import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import type { ReactNode } from 'react'
import { PonteEmbed } from '@/components/PonteEmbed'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata: Metadata = {
  title: 'Agendar demonstração · Takeat',
  description: 'Escolha o melhor dia e horário para conhecer a Takeat com um especialista.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f6f6' },
    { media: '(prefers-color-scheme: dark)', color: '#121212' },
  ],
}

// Antes do primeiro paint: tema forçado pela URL (?tema=claro|escuro) e modo embed (dentro de
// <iframe>), para não piscar o fundo nem o tema errado.
const scriptInicial = `(function(){try{var p=new URLSearchParams(location.search),t=p.get('tema'),d=document.documentElement;if(t==='escuro'||t==='dark')d.dataset.tema='escuro';else if(t==='claro'||t==='light')d.dataset.tema='claro';if(p.get('embed')==='1'||window.self!==window.top)d.dataset.embed='1'}catch(e){}})()`

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: script fixo, sem dado do usuário. */}
        <script dangerouslySetInnerHTML={{ __html: scriptInicial }} />
      </head>
      <body>
        {children}
        <PonteEmbed />
      </body>
    </html>
  )
}
