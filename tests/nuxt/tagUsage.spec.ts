import { describe, expect, it } from 'vitest'
import { indexTagUsage } from '~/queries/tags'
import type { ReportTagUsage } from '~/types/pocketbase'

const rows: ReportTagUsage[] = [
  { id: 't_winter', name: 'winter', color: '#2563eb', box_count: 1, item_count: 2 },
  { id: 't_fragile', name: 'fragile', color: '#dc2626', box_count: 2, item_count: 1 }
]

describe('indexTagUsage', () => {
  it('indexes counts by tag id', () => {
    const map = indexTagUsage(rows)
    expect(map.get('t_winter')).toEqual({ boxCount: 1, itemCount: 2 })
  })

  it('reports zero for a tag with no usage row rather than undefined', () => {
    expect(indexTagUsage(rows).get('t_unused') ?? { boxCount: 0, itemCount: 0 })
      .toEqual({ boxCount: 0, itemCount: 0 })
  })

  it('handles an empty report', () => {
    expect(indexTagUsage([]).size).toBe(0)
  })

  it('handles the report still loading', () => {
    expect(indexTagUsage(undefined).size).toBe(0)
  })
})
