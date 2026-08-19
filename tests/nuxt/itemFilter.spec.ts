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
})
