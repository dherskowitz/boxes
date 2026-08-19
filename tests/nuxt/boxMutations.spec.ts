import { describe, expect, it } from 'vitest'
import { boxUpdatePayload } from '~/queries/boxes'
import type { StorageBox } from '~/types/pocketbase'

const existing: StorageBox = {
  id: 'box1',
  created: '',
  updated: '',
  title: 'Winter coats and boots',
  description: '',
  location: 'Garage shelf A3',
  images: ['a.jpg'],
  qr_id: 'seedbox1',
  status: 'active',
  tags: ['t_winter'],
  created_by: 'u_dana'
}

describe('boxUpdatePayload', () => {
  it('never includes created_by, which the update rule rejects outright', () => {
    const payload = boxUpdatePayload(existing, { title: 'Winter coats' })
    expect('created_by' in payload).toBe(false)
  })

  it('never includes qr_id, which is fixed once printed', () => {
    const payload = boxUpdatePayload(existing, { title: 'Winter coats' })
    expect('qr_id' in payload).toBe(false)
  })

  it('sends only the fields that actually changed', () => {
    expect(boxUpdatePayload(existing, { title: 'Winter coats' })).toEqual({ title: 'Winter coats' })
  })

  it('returns an empty payload when nothing changed', () => {
    expect(boxUpdatePayload(existing, { title: existing.title })).toEqual({})
  })

  it('detects a tag list change by content, not identity', () => {
    expect(boxUpdatePayload(existing, { tags: ['t_winter'] })).toEqual({})
    expect(boxUpdatePayload(existing, { tags: ['t_winter', 't_fragile'] }))
      .toEqual({ tags: ['t_winter', 't_fragile'] })
  })
})
