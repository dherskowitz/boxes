import { describe, expect, it } from 'vitest'
import { boxQrUrl } from '~/utils/qrPayload'

describe('boxQrUrl', () => {
  it('encodes an absolute URL a phone camera can open unaided', () => {
    expect(boxQrUrl('seedbox1', 'https://storage.example.com'))
      .toBe('https://storage.example.com/box/seedbox1')
  })

  it('does not double up the slash when the origin has a trailing one', () => {
    expect(boxQrUrl('seedbox1', 'https://storage.example.com/'))
      .toBe('https://storage.example.com/box/seedbox1')
  })

  it('works against a local dev origin including its port', () => {
    expect(boxQrUrl('abc12345', 'http://127.0.0.1:3000'))
      .toBe('http://127.0.0.1:3000/box/abc12345')
  })

  it('refuses an empty qr_id rather than printing a label to the box list', () => {
    expect(() => boxQrUrl('', 'https://storage.example.com')).toThrow()
  })

  it('refuses an empty origin rather than printing a relative URL', () => {
    expect(() => boxQrUrl('seedbox1', '')).toThrow()
  })
})
