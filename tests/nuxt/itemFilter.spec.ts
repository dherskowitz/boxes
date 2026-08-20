import { describe, expect, it } from 'vitest'
import PocketBase from 'pocketbase'
import { itemFilter } from '~/queries/items'

describe('itemFilter', () => {
  it('scopes to the box', () => {
    expect(itemFilter({ boxId: 'b_winter' })).toEqual({
      raw: 'box = {:boxId}',
      params: { boxId: 'b_winter' }
    })
  })

  it('requires every selected tag', () => {
    expect(itemFilter({ boxId: 'b_winter', tagIds: ['t_winter', 't_fragile'] })).toEqual({
      raw: 'box = {:boxId} && tags ~ {:tag0} && tags ~ {:tag1}',
      params: { boxId: 'b_winter', tag0: 't_winter', tag1: 't_fragile' }
    })
  })

  it('treats an empty tag list as no tag clause', () => {
    expect(itemFilter({ boxId: 'b_winter', tagIds: [] })).toEqual({
      raw: 'box = {:boxId}',
      params: { boxId: 'b_winter' }
    })
  })

  it('never interpolates a user value into raw — raw is placeholders only', () => {
    const { raw } = itemFilter({ boxId: 'b" || id != "', tagIds: ['t" || 1=1'] })
    expect(raw).not.toContain('b" || id != "')
    expect(raw).not.toContain('t" || 1=1')
    expect(raw).toBe('box = {:boxId} && tags ~ {:tag0}')
  })

  it('escapes an injected quote so the executable filter cannot break out of its string literal', () => {
    const pb = new PocketBase('http://localhost')
    const { raw, params } = itemFilter({ boxId: 'x" || id != "' })
    expect(pb.filter(raw, params)).not.toContain('id != ""')
  })

  // Browsing across boxes — the /items contract. Deliberately NOT `searchFilter`:
  // that one short-circuits a blank term to `1 = 2`, the opposite default.
  it('filters to one box when given a box id', () => {
    const { raw, params } = itemFilter({ boxId: 'b1' })
    expect(raw).toContain('box = {:boxId}')
    expect(params.boxId).toBe('b1')
  })

  it('excludes archived boxes when browsing across boxes', () => {
    const { raw, params } = itemFilter({})
    expect(raw).toContain('box.status = {:status}')
    expect(params.status).toBe('active')
    expect(raw).not.toContain('box = {:boxId}')
  })

  it('matches a term against title, description and notes', () => {
    const { raw, params } = itemFilter({ term: 'peacoat' })
    expect(raw).toContain('title ~ {:term}')
    expect(raw).toContain('description ~ {:term}')
    expect(raw).toContain('notes ~ {:term}')
    expect(params.term).toBe('peacoat')
  })

  it('returns everything when no term is given — unlike searchFilter', () => {
    const { raw } = itemFilter({})
    expect(raw).not.toContain('1 = 2')
  })

  it('AND-matches every selected tag', () => {
    const { raw, params } = itemFilter({ tagIds: ['t1', 't2'] })
    expect(raw).toContain('tags ~ {:tag0}')
    expect(raw).toContain('tags ~ {:tag1}')
    expect(params.tag0).toBe('t1')
  })

  it('never lets a term or tag id reach raw', () => {
    const { raw } = itemFilter({ term: 'x" || id != "', tagIds: ['t" || 1=1'] })
    expect(raw).not.toContain('x"')
    expect(raw).not.toContain('t"')
  })

  // The term is the one genuinely user-typed input, so it gets the same
  // executable check the box id already has: escaped, not interpolated.
  it('escapes an injected quote in the term so the executable filter cannot break out', () => {
    const pb = new PocketBase('http://localhost')
    const { raw, params } = itemFilter({ term: 'x" || id != "' })
    expect(pb.filter(raw, params)).not.toContain('id != ""')
  })

  it('trims a whitespace-only term rather than filtering on it', () => {
    expect(itemFilter({ term: '   ' }).raw).not.toContain('title ~')
  })

  // Inside a box you are already scoped. Adding a status clause here would
  // hide an archived box's items from its own detail page.
  it('combines a box id and a term without the archived clause', () => {
    const { raw } = itemFilter({ boxId: 'b1', term: 'coat' })
    expect(raw).toContain('box = {:boxId}')
    expect(raw).toContain('title ~ {:term}')
    expect(raw).not.toContain('box.status')
  })
})
