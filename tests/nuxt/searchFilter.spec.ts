import { describe, expect, it } from 'vitest'
import PocketBase from 'pocketbase'
import { searchFilter } from '~/queries/search'

describe('searchFilter', () => {
  it('matches box title only, excluding archived boxes by default', () => {
    expect(searchFilter('coats', { kind: 'box' })).toEqual({
      raw: 'status = {:status} && title ~ {:search}',
      params: { status: 'active', search: 'coats' }
    })
  })

  it('matches item title, description and notes, excluding items whose box is archived', () => {
    expect(searchFilter('peacoat', { kind: 'item' })).toEqual({
      raw: 'box.status = {:status} && (title ~ {:search} || description ~ {:search} || notes ~ {:search})',
      params: { status: 'active', search: 'peacoat' }
    })
  })

  it('scopes item exclusion through the box relation, not an item-owned status', () => {
    // Items have no status field of their own — exclusion of an archived
    // box's items must travel through `box.status`, not `status`.
    const { raw } = searchFilter('albums', { kind: 'item' })
    expect(raw).toContain('box.status = {:status}')
  })

  it('returns a filter matching nothing for a blank term, rather than matching everything', () => {
    expect(searchFilter('', { kind: 'item' })).toEqual({ raw: '1 = 2', params: {} })
    expect(searchFilter('   ', { kind: 'box' })).toEqual({ raw: '1 = 2', params: {} })
  })

  it('passes the term through to params intact, quotes and all', () => {
    const { params } = searchFilter('a" quoted phrase', { kind: 'item' })
    expect(Object.values(params)).toContain('a" quoted phrase')
  })

  it('never interpolates a user value into raw — raw is placeholders only', () => {
    const { raw } = searchFilter('x" || id != "', { kind: 'item' })
    expect(raw).not.toContain('x"')
    expect(raw).not.toContain('||' + ' id != ')
  })

  it('escapes an injected quote so the executable filter cannot break out of its string literal', () => {
    const pb = new PocketBase('http://localhost')
    const { raw, params } = searchFilter('x" || id != "', { kind: 'item' })
    const executable = pb.filter(raw, params)
    expect(executable).not.toContain('id != ""')
  })
})
