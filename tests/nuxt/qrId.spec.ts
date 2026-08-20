import { describe, expect, it } from 'vitest'
import { newQrId } from '~/utils/qrId'

describe('newQrId', () => {
  it('is 8 characters', () => {
    expect(newQrId()).toHaveLength(8)
  })

  it('uses only lowercase alphanumerics, so it survives the id pattern and is typeable', () => {
    for (let i = 0; i < 200; i++) {
      expect(newQrId()).toMatch(/^[a-z0-9]{8}$/)
    }
  })

  it('does not repeat across many draws', () => {
    const seen = new Set(Array.from({ length: 500 }, () => newQrId()))
    expect(seen.size).toBe(500)
  })
})
