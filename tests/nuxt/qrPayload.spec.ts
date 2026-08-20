import { describe, expect, it } from 'vitest'
import { boxQrUrl, qrIdFromScan } from '~/utils/qrPayload'

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

describe('qrIdFromScan', () => {
  it('accepts a code this app printed', () => {
    expect(qrIdFromScan('https://storage.example.com/box/seedbox1')).toBe('seedbox1')
  })

  it('accepts one printed against a different origin, since the id is what matters', () => {
    expect(qrIdFromScan('http://127.0.0.1:3000/box/abc12345')).toBe('abc12345')
  })

  it('rejects an unrelated URL rather than navigating where a stranger says', () => {
    expect(qrIdFromScan('https://evil.example.com/phish')).toBeNull()
  })

  it('rejects a URL that merely contains /box/ elsewhere in the path', () => {
    expect(qrIdFromScan('https://evil.example.com/redirect?to=/box/seedbox1')).toBeNull()
  })

  it('rejects a malformed id', () => {
    expect(qrIdFromScan('https://storage.example.com/box/NOT-AN-ID')).toBeNull()
  })

  it('rejects arbitrary text', () => {
    expect(qrIdFromScan('just some text')).toBeNull()
  })

  it('rejects a javascript: payload', () => {
    expect(qrIdFromScan('javascript:alert(1)')).toBeNull()
  })
})
