// Quem atende cada faixa de faturamento do formulário do site (campo `faturamento_contato`).
//
//   'roleta'          → o time de AGENDA_VENDEDORES (ou todo o Inside Sales, se ela estiver vazia)
//   ['email', …]      → SÓ esses vendedores aparecem para o lead daquela faixa
//
// Exemplo — João atende até 50 mil e Luiza acima de 100 mil:
//   'ate-20k':    ['joao.takeat@gmail.com'],
//   '20k-50k':    ['joao.takeat@gmail.com'],
//   '50k-100k':   'roleta',
//   '100k-200k':  ['luiza.takeat@gmail.com'],
//   'acima-200k': ['luiza.takeat@gmail.com'],
//
// Com qualquer faixa preenchida, a agenda só aparece depois que o lead informa o faturamento (pelo
// formulário do site, pelo link ou pela pergunta na própria página). O link direto de um vendedor
// (/joao) não passa por aqui. Mudou este arquivo → novo deploy.
import type { VendedoresPorFaixa } from '@/lib/roteamento'

export const VENDEDORES_POR_FAIXA: VendedoresPorFaixa = {
  'ate-20k': 'roleta',
  '20k-50k': 'roleta',
  '50k-100k': 'roleta',
  '100k-200k': 'roleta',
  'acima-200k': 'roleta',
}
