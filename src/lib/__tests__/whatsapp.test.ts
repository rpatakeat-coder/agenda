import { describe, expect, it } from 'vitest'
import { formatarWhatsapp, linkDoWhatsapp, whatsappDoVendedor } from '../whatsapp'

describe('WhatsApp do vendedor', () => {
  it('normaliza o número do jeito que está no cadastro do OS', () => {
    expect(whatsappDoVendedor('27999998888')).toBe('+5527999998888')
    expect(whatsappDoVendedor('5527999998888')).toBe('+5527999998888')
    expect(whatsappDoVendedor('(27) 99999-8888')).toBe('+5527999998888')
    expect(whatsappDoVendedor('+55 27 99999-8888')).toBe('+5527999998888')
  })

  it('sem número que sirva: null (a confirmação não mostra o botão)', () => {
    expect(whatsappDoVendedor(null)).toBeNull()
    expect(whatsappDoVendedor('')).toBeNull()
    expect(whatsappDoVendedor('123')).toBeNull()
  })

  it('formata para exibir e monta o link com a mensagem', () => {
    expect(formatarWhatsapp('+5527999998888')).toBe('(27) 99999-8888')
    expect(linkDoWhatsapp('+5527999998888')).toBe('https://wa.me/5527999998888')
    expect(linkDoWhatsapp('+5527999998888', 'Olá, Lucas!')).toBe(
      'https://wa.me/5527999998888?text=Ol%C3%A1%2C%20Lucas!',
    )
  })
})
