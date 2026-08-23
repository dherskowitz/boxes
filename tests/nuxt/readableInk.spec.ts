import { describe, expect, it } from 'vitest'
import { readableInk } from '~/utils/readableInk'

// The five colours the seed actually stores, which is what the chips render.
describe('readableInk on the seeded tag colours', () => {
  it('puts white on the dark ones', () => {
    expect(readableInk('#dc2626')).toBe('#ffffff') // fragile, red,    L 0.167
    expect(readableInk('#2563eb')).toBe('#ffffff') // winter, blue,    L 0.153
    expect(readableInk('#9333ea')).toBe('#ffffff') // sentimental,     L 0.145
  })

  it('puts dark ink on the two that white cannot carry', () => {
    // Both sit above the 0.179 crossover, where white drops under 4.5:1 and
    // black clears 6:1. The green especially reads as mush with white on it.
    expect(readableInk('#16a34a')).toBe('#16130f') // kitchen,   L 0.269
    expect(readableInk('#ca8a04')).toBe('#16130f') // paperwork, L 0.307
  })
})

describe('readableInk', () => {
  it('picks dark ink on a light background', () => {
    expect(readableInk('#ffffff')).toBe('#16130f')
    expect(readableInk('#f7f5f0')).toBe('#16130f')
    expect(readableInk('#F2C94C')).toBe('#16130f')
  })

  it('picks white on a dark background', () => {
    expect(readableInk('#000000')).toBe('#ffffff')
    expect(readableInk('#1c1a17')).toBe('#ffffff')
  })

  it('weights green brighter than blue at the same channel value', () => {
    // The whole reason for the luminance formula: averaging would give these
    // two the same answer, and one of them would be unreadable.
    expect(readableInk('#00ff00')).toBe('#16130f')
    expect(readableInk('#0000ff')).toBe('#ffffff')
  })

  it('accepts shorthand hex and a missing hash', () => {
    expect(readableInk('#fff')).toBe('#16130f')
    expect(readableInk('000')).toBe('#ffffff')
  })

  it('falls back to white for anything it cannot parse', () => {
    // A stored value could be a CSS variable or a named colour; the chip still
    // has to render something legible on the app's accent.
    expect(readableInk('var(--sb-accent)')).toBe('#ffffff')
    expect(readableInk('rebeccapurple')).toBe('#ffffff')
    expect(readableInk('')).toBe('#ffffff')
  })
})
