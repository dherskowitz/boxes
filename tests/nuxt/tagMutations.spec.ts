import { describe, expect, it } from 'vitest'
import { normalizeTagName } from '~/queries/tags'

describe('normalizeTagName', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeTagName('  winter  ')).toBe('winter')
  })

  it('lowercases, so Winter and winter cannot both exist', () => {
    expect(normalizeTagName('Winter')).toBe('winter')
  })

  it('collapses internal whitespace', () => {
    expect(normalizeTagName('tax   records')).toBe('tax records')
  })

  it('leaves an already-clean name alone', () => {
    expect(normalizeTagName('paperwork')).toBe('paperwork')
  })

  it('returns empty for whitespace only, which the caller must reject', () => {
    expect(normalizeTagName('   ')).toBe('')
  })
})
