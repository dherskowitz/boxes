import { describe, expect, it } from 'vitest'
import PocketBase from 'pocketbase'
import { boxFilter } from '~/queries/boxes'

describe('boxFilter', () => {
  it('defaults to active boxes only', () => {
    expect(boxFilter({})).toEqual({ raw: 'status = {:status}', params: { status: 'active' } })
  })

  it('includes archived boxes when asked', () => {
    expect(boxFilter({ status: 'archived' })).toEqual({
      raw: 'status = {:status}',
      params: { status: 'archived' }
    })
  })

  it('requires every selected tag', () => {
    expect(boxFilter({ tagIds: ['t_kitchen', 't_fragile'] })).toEqual({
      raw: 'status = {:status} && tags ~ {:tag0} && tags ~ {:tag1}',
      params: { status: 'active', tag0: 't_kitchen', tag1: 't_fragile' }
    })
  })

  it('searches title, description and location', () => {
    expect(boxFilter({ search: 'garage' })).toEqual({
      raw: 'status = {:status} && (title ~ {:search} || description ~ {:search} || location ~ {:search})',
      params: { status: 'active', search: 'garage' }
    })
  })

  it('passes the search term through to params unmodified, quotes and all', () => {
    const { params } = boxFilter({ search: 'a" || 1=1 || "' })
    expect(params.search).toBe('a" || 1=1 || "')
  })

  it('never interpolates a user value into raw — raw is placeholders only', () => {
    const { raw } = boxFilter({ search: 'x" || id != "', tagIds: ['t" || 1=1'] })
    expect(raw).not.toContain('x" || id != "')
    expect(raw).not.toContain('t" || 1=1')
    expect(raw).toBe(
      'status = {:status} && tags ~ {:tag0} && (title ~ {:search} || description ~ {:search} || location ~ {:search})'
    )
  })

  it('escapes an injected quote so the executable filter cannot break out of its string literal', () => {
    const pb = new PocketBase('http://localhost')
    const { raw, params } = boxFilter({ search: 'x" || id != "' })
    const executable = pb.filter(raw, params)
    expect(executable).not.toContain('id != ""')
  })
})
