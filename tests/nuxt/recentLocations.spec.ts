import { describe, expect, it } from 'vitest'
import { recentLocations } from '~/utils/recentLocations'

const box = (location: string, id = location) => ({
  id,
  title: id,
  location,
  status: 'active' as const,
  item_count: 0,
  photo_count: 0
})

describe('recentLocations', () => {
  it('returns nothing when there are no boxes', () => {
    expect(recentLocations(undefined)).toEqual([])
    expect(recentLocations([])).toEqual([])
  })

  it('ranks by how many boxes use each location', () => {
    const rows = [
      box('Loft', 'a'),
      box('Basement closet', 'b'),
      box('Basement closet', 'c'),
      box('Basement closet', 'd'),
      box('Loft', 'e')
    ]
    expect(recentLocations(rows)).toEqual(['Basement closet', 'Loft'])
  })

  it('drops boxes with no location rather than offering an empty chip', () => {
    // `location` has no schema default, so an unfilled one comes back as ''.
    // Whitespace counts as unfilled too — offering "   " as a suggestion would
    // put an invisible option in the list.
    const rows = [box('Loft', 'a'), box('', 'b'), box('   ', 'c')]
    expect(recentLocations(rows)).toEqual(['Loft'])
  })

  it('treats locations differing only in surrounding space as one', () => {
    // Otherwise "Loft" typed once with a trailing space splits the count and
    // offers the same shelf twice.
    const rows = [box('Loft', 'a'), box(' Loft ', 'b'), box('Garage', 'c')]
    expect(recentLocations(rows)).toEqual(['Loft', 'Garage'])
  })

  it('keeps the casing of the first spelling it saw', () => {
    // Matching case-insensitively stops "loft" and "Loft" being two entries,
    // but the suggestion has to be typeable text, not a lowercased key.
    const rows = [box('Loft', 'a'), box('loft', 'b')]
    expect(recentLocations(rows)).toEqual(['Loft'])
  })

  it('breaks ties on the first spelling seen, so the list does not reshuffle', () => {
    // Equal counts must be deterministic: a suggestion row that reorders
    // between renders is a moving target for a thumb.
    const rows = [box('Garage', 'a'), box('Attic', 'b')]
    expect(recentLocations(rows)).toEqual(['Garage', 'Attic'])
  })

  it('caps the list so the row cannot grow past a thumb-sized set', () => {
    const rows = Array.from({ length: 12 }, (_, i) => box(`Shelf ${i}`, `id${i}`))
    expect(recentLocations(rows)).toHaveLength(6)
  })

  it('excludes the location already typed, which needs no suggesting', () => {
    const rows = [box('Loft', 'a'), box('Garage', 'b')]
    expect(recentLocations(rows, 'loft')).toEqual(['Garage'])
  })
})
