import { describe, expect, it } from 'vitest'
import { boxFilter } from '~/queries/boxes'

describe('boxFilter', () => {
  it('defaults to active boxes only', () => {
    expect(boxFilter({})).toBe('status = "active"')
  })

  it('includes archived boxes when asked', () => {
    expect(boxFilter({ status: 'archived' })).toBe('status = "archived"')
  })

  it('requires every selected tag', () => {
    expect(boxFilter({ tagIds: ['t_kitchen', 't_fragile' ] }))
      .toBe('status = "active" && tags ~ "t_kitchen" && tags ~ "t_fragile"')
  })

  it('searches title, description and location', () => {
    expect(boxFilter({ search: 'garage' }))
      .toBe('status = "active" && (title ~ "garage" || description ~ "garage" || location ~ "garage")')
  })

  it('strips quotes from the search term so the filter cannot be broken', () => {
    expect(boxFilter({ search: 'a" || 1=1 || "' }))
      .toBe('status = "active" && (title ~ "a || 1=1 || " || description ~ "a || 1=1 || " || location ~ "a || 1=1 || ")')
  })
})
