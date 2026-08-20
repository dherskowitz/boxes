import { describe, expect, it } from 'vitest'
import { commentUpdatePayload } from '~/queries/comments'
import type { StorageComment } from '~/types/pocketbase'

const existing: StorageComment = {
  id: 'c1', created: '', updated: '', item: 'i1', user: 'u_sam',
  text: 'Is this the one with the missing button?'
}

describe('commentUpdatePayload', () => {
  it('never includes user, which the update rule rejects outright', () => {
    expect('user' in commentUpdatePayload(existing, 'Edited')).toBe(false)
  })

  it('never includes item — a comment does not move between items', () => {
    expect('item' in commentUpdatePayload(existing, 'Edited')).toBe(false)
  })

  it('sends only the changed text', () => {
    expect(commentUpdatePayload(existing, 'Edited')).toEqual({ text: 'Edited' })
  })

  it('returns an empty payload when the text is unchanged', () => {
    expect(commentUpdatePayload(existing, existing.text)).toEqual({})
  })
})
