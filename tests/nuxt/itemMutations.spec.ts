import { describe, expect, it } from 'vitest'
import { itemUpdatePayload } from '~/queries/items'
import type { StorageItem } from '~/types/pocketbase'

const existing: StorageItem = {
  id: 'i1',
  created: '',
  updated: '',
  box: 'box1',
  title: 'Navy wool peacoat',
  description: 'Size M',
  notes: 'Dry clean first',
  images: [],
  tags: [],
  created_by: 'u_dana'
}

describe('itemUpdatePayload', () => {
  it('never includes created_by, which the update rule rejects outright', () => {
    expect('created_by' in itemUpdatePayload(existing, { title: 'Peacoat' })).toBe(false)
  })

  it('sends only what changed', () => {
    expect(itemUpdatePayload(existing, { notes: 'Dry clean first' })).toEqual({})
    expect(itemUpdatePayload(existing, { notes: 'Repaired' })).toEqual({ notes: 'Repaired' })
  })

  it('allows moving an item to another box', () => {
    expect(itemUpdatePayload(existing, { box: 'box2' })).toEqual({ box: 'box2' })
  })
})
