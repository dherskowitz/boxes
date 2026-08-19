import { describe, expect, it } from 'vitest'
import { canDeleteBox, canEditBox, canEditComment, canEditItem } from '~/composables/useCanEdit'
import type { StorageBox, StorageBoxPermission, StorageComment } from '~/types/pocketbase'

const box: StorageBox = {
  id: 'b_winter',
  created: '2026-01-04 10:00:00Z',
  updated: '2026-01-04 10:00:00Z',
  title: 'Winter coats and boots',
  description: '',
  location: 'Loft, north wall',
  images: [],
  qr_id: 'seedbox1',
  status: 'active',
  tags: ['t_winter'],
  created_by: 'u_dana'
}

function grant(overrides: Partial<StorageBoxPermission> = {}): StorageBoxPermission {
  return {
    id: 'p_1',
    created: '2026-01-04 10:00:00Z',
    updated: '2026-01-04 10:00:00Z',
    box: 'b_winter',
    user: 'u_sam',
    role: 'editor',
    ...overrides
  }
}

describe('canEditBox', () => {
  it('lets the creator edit', () => {
    expect(canEditBox(box, 'u_dana', [])).toBe(true)
  })

  it('lets a granted editor edit', () => {
    expect(canEditBox(box, 'u_sam', [grant()])).toBe(true)
  })

  it('refuses a plain member with no grant', () => {
    expect(canEditBox(box, 'u_rae', [])).toBe(false)
  })

  it("refuses a member holding someone else's grant", () => {
    expect(canEditBox(box, 'u_rae', [grant({ user: 'u_sam' })])).toBe(false)
  })

  it('refuses a grant that belongs to a different box', () => {
    expect(canEditBox(box, 'u_sam', [grant({ box: 'b_kitchen' })])).toBe(false)
  })

  it('refuses a grant whose role was never set', () => {
    expect(canEditBox(box, 'u_sam', [grant({ role: '' })])).toBe(false)
  })

  it('refuses a granted editor until the permissions have loaded', () => {
    expect(canEditBox(box, 'u_sam', undefined)).toBe(false)
  })

  it('still trusts the creator while the permissions are loading', () => {
    expect(canEditBox(box, 'u_dana', undefined)).toBe(true)
  })

  it('refuses while the box itself is loading', () => {
    expect(canEditBox(undefined, 'u_dana', [])).toBe(false)
  })

  it('refuses a signed-out visitor even against an unowned box', () => {
    expect(canEditBox({ ...box, created_by: '' }, '', [])).toBe(false)
  })
})

describe('canDeleteBox', () => {
  it('lets the creator delete', () => {
    expect(canDeleteBox(box, 'u_dana')).toBe(true)
  })

  it('refuses a granted editor — an editor grant does not extend to delete', () => {
    expect(canDeleteBox(box, 'u_sam')).toBe(false)
  })

  it('refuses while the box is loading', () => {
    expect(canDeleteBox(undefined, 'u_dana')).toBe(false)
  })

  it('refuses a signed-out visitor', () => {
    expect(canDeleteBox({ ...box, created_by: '' }, '')).toBe(false)
  })
})

describe('canEditItem', () => {
  it('follows the item’s box: the box creator may edit its items', () => {
    expect(canEditItem(box, 'u_dana', [])).toBe(true)
  })

  it('follows the item’s box: a granted editor may edit its items', () => {
    expect(canEditItem(box, 'u_sam', [grant()])).toBe(true)
  })

  it('refuses a member with no grant on the box', () => {
    expect(canEditItem(box, 'u_rae', [])).toBe(false)
  })
})

describe('canEditComment', () => {
  const comment: StorageComment = {
    id: 'c_1',
    created: '2026-01-05 09:00:00Z',
    updated: '2026-01-05 09:00:00Z',
    item: 'i_peacoat',
    user: 'u_sam',
    text: 'Is this the navy one or the charcoal one?'
  }

  it('lets the author edit their own comment', () => {
    expect(canEditComment(comment, 'u_sam')).toBe(true)
  })

  it('refuses everyone else, including the box creator', () => {
    expect(canEditComment(comment, 'u_dana')).toBe(false)
  })

  it('refuses while the comment is loading', () => {
    expect(canEditComment(undefined, 'u_sam')).toBe(false)
  })

  it('refuses a signed-out visitor', () => {
    expect(canEditComment({ ...comment, user: '' }, '')).toBe(false)
  })
})
