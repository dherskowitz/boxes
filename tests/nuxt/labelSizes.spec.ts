import { describe, expect, it } from 'vitest'
import {
  LABEL_SIZES,
  PRINTABLE_HEIGHT_IN,
  PRINTABLE_WIDTH_IN,
  labelSize,
  perRow,
  perSheet
} from '~/utils/labelSizes'

describe('label sizes', () => {
  it('never offers a size wider or taller than a Letter sheet can print', () => {
    for (const size of LABEL_SIZES) {
      expect(size.width, size.id).toBeLessThanOrEqual(PRINTABLE_WIDTH_IN)
      expect(size.height, size.id).toBeLessThanOrEqual(PRINTABLE_HEIGHT_IN)
    }
  })

  // 4 × 3⅓ is deliberately stacked despite being wide — see the registry.
  it('puts the title beside the code only on a label wide enough to want it', () => {
    for (const size of LABEL_SIZES) {
      if (size.layout !== 'beside') continue
      // Beside means the title shares the row with the code, so there has to
      // be width left over once the code has taken its square.
      expect(size.width - size.qr, size.id).toBeGreaterThan(1.2)
    }
  })

  it('gives a stacked label room for the code and the title', () => {
    for (const size of LABEL_SIZES) {
      if (size.layout !== 'stacked') continue
      expect(size.qr, size.id).toBeLessThan(size.height - 0.5)
    }
  })

  // 4 × 3⅓ is sold six to a sheet. Landing on six from our own arithmetic is
  // the check that the arithmetic matches the real world.
  it('works out six to a sheet for 4 × 3⅓, as the stock is sold', () => {
    const shipping = LABEL_SIZES.find(size => size.id === '4x3')
    expect(shipping).toBeDefined()
    if (!shipping) return
    expect(perRow(shipping)).toBe(2)
    expect(perSheet(shipping)).toBe(6)
  })

  it('falls back rather than returning undefined for an id it does not know', () => {
    // The id comes out of localStorage, which can hold anything a previous
    // version wrote.
    expect(labelSize('nonsense', '2x2').id).toBe('2x2')
    expect(labelSize(null, '4x4').id).toBe('4x4')
    // Both wrong still has to produce a size, not a crash on a print page.
    expect(labelSize('nonsense', 'also-nonsense')).toBeDefined()
  })

  it('has unique ids, since the id is the stored preference', () => {
    const ids = LABEL_SIZES.map(size => size.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
