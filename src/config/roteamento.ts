// Distribuição dos leads do site entre os vendedores do Inside Sales, pelas respostas do formulário
// do takeat.app (`faturamento_contato` e `quantidade_mesas`). Definida pelo time comercial em
// 19/10/2026. Mudou aqui → novo deploy.
//
// 1. SEGMENTO_POR_RESPOSTA: em que segmento cai cada resposta. Faixa que depende das mesas tem uma
//    tabela por quantidade de mesas — e, se o lead chegar sem essa resposta, a página pergunta.
// 2. VENDEDORES_POR_SEGMENTO: quem atende cada segmento. 'roleta' = todo o time de
//    AGENDA_VENDEDORES (vazia = todos com agenda conectada). E-mails = SÓ essas pessoas.
//
// O link direto de um vendedor (/caio-caiado) não passa por aqui: quem mandou o link escolheu.
import type { SegmentoPorResposta, VendedoresPorSegmento } from '@/lib/roteamento'

/** Até 50 mil: o segmento sai das mesas (até 10 ou sem mesas = LOW; 10 ou mais = MID). */
const ATE_50_MIL = { 'ate-10': 'low', '10-30': 'mid', 'acima-30': 'mid', 'sem-mesas': 'low' } as const

export const SEGMENTO_POR_RESPOSTA: SegmentoPorResposta = {
  'ate-20k': ATE_50_MIL,
  '20k-50k': ATE_50_MIL,
  '50k-100k': 'mid',
  '100k-200k': 'high',
  'acima-200k': 'high',
}

export const VENDEDORES_POR_SEGMENTO: VendedoresPorSegmento = {
  high: [
    'luizasodre.takeat@gmail.com', // Luiza Dallapicola
    'marcelo.takeat@gmail.com', // Marcelo Amon
    'thayrone.takeat@gmail.com', // Thayrone Silva
    'caiocaiado.takeat@gmail.com', // Caio Caiado
    'andrerocon.takeat@gmail.com', // Andre Rocon
    'vitorquintela.takeat@gmail.com', // Vitor Quintela (Vitinho)
  ],
  mid: 'roleta',
  low: [
    'rodrigoesteves.takeat@gmail.com', // Rodrigo Esteves
    'isabelallaraujo.takeat@gmail.com', // Isabela
    'amanda.takeat@gmail.com', // Amanda Pardim
    'gustavofreitas.takeat@gmail.com', // Gustavo de Freitas Pinto
    'mariacosmo.takeat@gmail.com', // Maria Eduarda Cosmo
  ],
}
