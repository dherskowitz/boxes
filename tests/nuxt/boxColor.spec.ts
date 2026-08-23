import { describe, it, expect } from 'vitest'
import { boxColor, boxColorVars } from '~/utils/boxColor'

describe('boxColor', () => {
  it('gives one box the same colour every time it is asked', () => {
    expect(boxColor('4f2a9c')).toEqual(boxColor('4f2a9c'))
  })

  it('spreads different boxes across the palette', () => {
    const ids = ['4f2a9c', '88b117', '2c0d45', '71e9f3', 'a10b2c', 'ff0099']
    const colors = new Set(ids.map(id => boxColor(id).color))
    // Not a promise of all-distinct — eight buckets and six ids can collide —
    // but a single-colour result would mean the hash is not mixing at all.
    expect(colors.size).toBeGreaterThan(1)
  })

  it('pairs every fill with a text colour', () => {
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      expect(boxColor(id).on).toMatch(/^#/)
    }
  })

  it('exposes the pair as the custom properties the stylesheet reads', () => {
    const vars = boxColorVars('4f2a9c')
    expect(Object.keys(vars)).toEqual(['--c', '--c-on'])
    expect(vars['--c']).toMatch(/^oklch\(/)
  })
})
