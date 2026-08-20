import { describe, expect, it } from 'vitest'
import { groupByLocation, reportTotals, topBoxesByItems, topTagsByUsage } from '~/queries/reports'
import type { ReportBoxFill, ReportTagUsage } from '~/types/pocketbase'

const winterCoats: ReportBoxFill = { id: 'b1', title: 'Winter coats and boots', location: 'Garage shelf A3', status: 'active', item_count: 3, photo_count: 0 }

const fill: ReportBoxFill[] = [
  winterCoats,
  { id: 'b2', title: 'Kitchen overflow', location: 'Basement under the stairs', status: 'active', item_count: 2, photo_count: 0 },
  { id: 'b3', title: 'Tax records 2019-2023', location: 'Office closet, top shelf', status: 'active', item_count: 3, photo_count: 0 },
  { id: 'b4', title: 'Empty spare box', location: 'Garage shelf B1', status: 'active', item_count: 0, photo_count: 0 },
  { id: 'b5', title: 'College photo albums', location: 'Attic', status: 'archived', item_count: 1, photo_count: 0 }
]

describe('topBoxesByItems', () => {
  it('ranks by item count, descending', () => {
    expect(topBoxesByItems(fill, 10).map(b => b.id)).toEqual(['b1', 'b3', 'b2', 'b4'])
  })

  it('excludes archived boxes from the ranking, per the spec', () => {
    expect(topBoxesByItems(fill, 10).some(b => b.id === 'b5')).toBe(false)
  })

  it('caps at the requested size', () => {
    expect(topBoxesByItems(fill, 2)).toHaveLength(2)
  })

  it('handles the report still loading', () => {
    expect(topBoxesByItems(undefined, 10)).toEqual([])
  })
})

describe('groupByLocation', () => {
  it('counts boxes per location', () => {
    const groups = groupByLocation(fill)
    expect(groups.find(g => g.location === 'Garage shelf A3')?.count).toBe(1)
    expect(groups).toHaveLength(5)
  })

  it('buckets boxes with no location rather than dropping them', () => {
    const withBlank = [...fill, { ...winterCoats, id: 'b6', location: '' }]
    expect(groupByLocation(withBlank).find(g => g.location === 'No location')?.count).toBe(1)
  })

  it('handles the report still loading', () => {
    expect(groupByLocation(undefined)).toEqual([])
  })
})

describe('topTagsByUsage', () => {
  it('ranks by combined box and item usage', () => {
    const tags: ReportTagUsage[] = [
      { id: 't1', name: 'winter', color: '', box_count: 1, item_count: 2 },
      { id: 't2', name: 'fragile', color: '', box_count: 2, item_count: 1 },
      { id: 't3', name: 'paperwork', color: '', box_count: 1, item_count: 3 }
    ]
    expect(topTagsByUsage(tags, 10).map(t => t.id)).toEqual(['t3', 't1', 't2'])
  })
})

describe('reportTotals', () => {
  it('counts boxes, items, tags and photos, including archived boxes', () => {
    const tags: ReportTagUsage[] = [
      { id: 't1', name: 'winter', color: '', box_count: 1, item_count: 2 }
    ]
    expect(reportTotals(fill, tags)).toEqual({ boxes: 5, items: 9, tags: 1, photos: 0 })
  })

  it('reports zeroes on a fresh instance rather than throwing', () => {
    expect(reportTotals([], [])).toEqual({ boxes: 0, items: 0, tags: 0, photos: 0 })
  })

  it('handles both reports still loading', () => {
    expect(reportTotals(undefined, undefined)).toEqual({ boxes: 0, items: 0, tags: 0, photos: 0 })
  })
})
