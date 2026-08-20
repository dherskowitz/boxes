import { describe, expect, it } from 'vitest'
import { countUnread } from '~/composables/useUnreadComments'
import type { StorageComment } from '~/types/pocketbase'

const c = (id: string, created: string, user: string): StorageComment =>
  ({ id, created, updated: created, item: 'i1', user, text: 'x' })

const comments = [
  c('c1', '2026-08-01 10:00:00Z', 'u_sam'),
  c('c2', '2026-08-03 10:00:00Z', 'u_dana'),
  c('c3', '2026-08-05 10:00:00Z', 'u_sam')
]

describe('countUnread', () => {
  it('counts comments newer than the last view', () => {
    expect(countUnread(comments, '2026-08-02 00:00:00Z', 'u_rae')).toBe(2)
  })

  it('never counts your own comments — you just wrote them', () => {
    expect(countUnread(comments, '2026-08-02 00:00:00Z', 'u_sam')).toBe(1)
  })

  it('counts everything when the item has never been viewed', () => {
    expect(countUnread(comments, null, 'u_rae')).toBe(3)
  })

  it('counts nothing when everything predates the last view', () => {
    expect(countUnread(comments, '2026-09-01 00:00:00Z', 'u_rae')).toBe(0)
  })

  it('handles comments still loading', () => {
    expect(countUnread(undefined, null, 'u_rae')).toBe(0)
  })
})
