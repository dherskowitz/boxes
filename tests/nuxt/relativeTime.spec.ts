import { describe, expect, it } from 'vitest'
import { relativeTime } from '~/utils/relativeTime'

// PocketBase stamps are "2026-08-24 09:00:00.000Z".
const at = (iso: string) => new Date(iso).getTime()
const NOW = at('2026-08-24T12:00:00Z')

describe('relativeTime', () => {
  it('calls anything inside a minute "just now" rather than "0 seconds ago"', () => {
    expect(relativeTime('2026-08-24 11:59:30Z', NOW)).toBe('just now')
    expect(relativeTime('2026-08-24 12:00:00Z', NOW)).toBe('just now')
  })

  it('counts in minutes, then hours, then days', () => {
    expect(relativeTime('2026-08-24 11:45:00Z', NOW)).toBe('15 minutes ago')
    expect(relativeTime('2026-08-24 09:00:00Z', NOW)).toBe('3 hours ago')
    expect(relativeTime('2026-08-22 12:00:00Z', NOW)).toBe('2 days ago')
  })

  it('uses the singular at exactly one unit', () => {
    expect(relativeTime('2026-08-24 11:59:00Z', NOW)).toBe('1 minute ago')
    expect(relativeTime('2026-08-24 11:00:00Z', NOW)).toBe('1 hour ago')
    expect(relativeTime('2026-08-23 12:00:00Z', NOW)).toBe('1 day ago')
  })

  it('moves up to months and years rather than counting hundreds of days', () => {
    expect(relativeTime('2026-06-24 12:00:00Z', NOW)).toBe('2 months ago')
    expect(relativeTime('2024-08-24 12:00:00Z', NOW)).toBe('2 years ago')
  })

  it('parses the space-separated stamp PocketBase actually returns', () => {
    // Not the "T" form. Safari refuses to parse "2026-08-22 12:00:00Z" and
    // returns NaN, which would render "Invalid Date" on an iPhone only.
    expect(relativeTime('2026-08-22 12:00:00.000Z', NOW)).toBe('2 days ago')
  })

  it('returns an empty string for a missing or unparseable stamp', () => {
    // A record field with no value is '' — better to render nothing than
    // "Invalid Date ago" under a box someone just scanned.
    expect(relativeTime('', NOW)).toBe('')
    expect(relativeTime('not a date', NOW)).toBe('')
  })

  it('does not claim the future when a clock is a little ahead', () => {
    // Device clocks drift and the server stamps the record. A box "updated in
    // 3 seconds" reads as a bug; inside the minute it is just now.
    expect(relativeTime('2026-08-24 12:00:20Z', NOW)).toBe('just now')
  })
})
