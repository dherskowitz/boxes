import { describe, expect, it } from 'vitest'
import { searchResults } from '~/queries/search'
import type { StorageBox, StorageItem } from '~/types/pocketbase'

const base = { created: '2026-01-01 00:00:00Z', updated: '2026-01-01 00:00:00Z' }

function box(fields: Partial<StorageBox> & { id: string }): StorageBox {
  return {
    ...base,
    title: '',
    description: '',
    location: '',
    images: [],
    qr_id: fields.id,
    status: 'active',
    tags: [],
    created_by: 'u_dana',
    ...fields
  }
}

function item(fields: Partial<StorageItem> & { id: string, box: string }): StorageItem {
  return {
    ...base,
    title: '',
    description: '',
    notes: '',
    images: [],
    tags: [],
    created_by: 'u_dana',
    ...fields
  }
}

const camping = box({ id: 'b_camping', title: 'Camping Gear', location: 'Garage shelf B2' })
const emergency = box({
  id: 'b_emergency',
  title: 'Emergency Kit',
  location: 'Hall closet',
  description: 'Torch, batteries and a camp stove.'
})

describe('searchResults', () => {
  it('says nothing extra when the title itself matched — the highlight already shows why', () => {
    const results = searchResults([camping], [], 'camping')
    expect(results).toEqual([{ kind: 'box', box: camping, reason: { kind: 'title' } }])
  })

  it('names the field that matched when it was not the title', () => {
    const results = searchResults([emergency], [], 'stove')
    expect(results).toEqual([{ kind: 'box', box: emergency, reason: { kind: 'description' } }])
  })

  it('names the location when that is what matched', () => {
    const results = searchResults([camping], [], 'garage')
    expect(results).toEqual([{ kind: 'box', box: camping, reason: { kind: 'location' } }])
  })

  it('prefers the field the reader can see over one they cannot', () => {
    // A term in both the title and the description is explained by the
    // highlighted title; "matched description" would send them looking for a
    // second reason that adds nothing.
    const both = box({ id: 'b_both', title: 'Stove spares', description: 'A spare stove.' })
    expect(searchResults([both], [], 'stove')[0]).toEqual({
      kind: 'box',
      box: both,
      reason: { kind: 'title' }
    })
  })

  it('surfaces a box whose items matched even though the box itself did not', () => {
    // The whole point of searching: "stove" is not written on the box, it is
    // written on the thing inside it.
    const stove = item({ id: 'i_stove', box: 'b_camping', title: 'Camp stove', expand: { box: camping } })
    const results = searchResults([], [stove], 'stove')

    expect(results).toEqual([
      { kind: 'box', box: camping, reason: { kind: 'items', count: 1 } },
      { kind: 'item', item: stove }
    ])
  })

  it('counts every matching item in a box it surfaced', () => {
    const a = item({ id: 'i_a', box: 'b_camping', title: 'Camp stove', expand: { box: camping } })
    const b = item({ id: 'i_b', box: 'b_camping', title: 'Stove windscreen', expand: { box: camping } })
    const [first] = searchResults([], [a, b], 'stove')
    expect(first).toEqual({ kind: 'box', box: camping, reason: { kind: 'items', count: 2 } })
  })

  it('pluralises the count field, not the label', () => {
    const one = item({ id: 'i_a', box: 'b_camping', title: 'Camp stove', expand: { box: camping } })
    const [first] = searchResults([], [one], 'stove')
    expect(first).toMatchObject({ reason: { count: 1 } })
  })

  it('does not list a box twice when it matched directly and through its items', () => {
    // Emergency Kit matches on description and holds a matching item. It is
    // one box and gets one row; the direct reason wins because it is about the
    // box, not about something in it.
    const fuel = item({ id: 'i_fuel', box: 'b_emergency', title: 'Stove fuel', expand: { box: emergency } })
    const results = searchResults([emergency], [fuel], 'stove')

    expect(results.filter(r => r.kind === 'box')).toHaveLength(1)
    expect(results[0]).toEqual({ kind: 'box', box: emergency, reason: { kind: 'description' } })
  })

  it('keeps every matching item listed, including ones inside a surfaced box', () => {
    // The box row and the item row answer different questions — "which box do
    // I open" and "is the thing I want actually here".
    const stove = item({ id: 'i_stove', box: 'b_camping', title: 'Camp stove', expand: { box: camping } })
    const results = searchResults([camping], [stove], 'camping')
    expect(results.filter(r => r.kind === 'item')).toEqual([{ kind: 'item', item: stove }])
  })

  it('puts boxes that matched directly ahead of ones surfaced through their items', () => {
    const stove = item({ id: 'i_stove', box: 'b_camping', title: 'Camp stove', expand: { box: camping } })
    const results = searchResults([emergency], [stove], 'stove')
    expect(results.filter(r => r.kind === 'box').map(r => r.box.id))
      .toEqual(['b_emergency', 'b_camping'])
  })

  it('ignores an item whose box was never expanded rather than inventing a row', () => {
    const orphan = item({ id: 'i_orphan', box: 'b_gone', title: 'Camp stove' })
    const results = searchResults([], [orphan], 'stove')
    expect(results).toEqual([{ kind: 'item', item: orphan }])
  })

  it('matches case-insensitively, the way the query that found these did', () => {
    const results = searchResults([emergency], [], 'STOVE')
    expect(results[0]).toEqual({ kind: 'box', box: emergency, reason: { kind: 'description' } })
  })

  it('falls back to the item count when a box matched on a field it cannot show', () => {
    // The description is an editor field, so a term can match markup that is
    // nowhere in the rendered text. Claiming "matched description" then points
    // at words the reader cannot find. Nothing visible matched, so say nothing.
    const markup = box({ id: 'b_markup', title: 'Loft odds', description: '<div>nothing here</div>' })
    expect(searchResults([markup], [], 'div')[0]).toEqual({
      kind: 'box',
      box: markup,
      reason: { kind: 'unknown' }
    })
  })
})
