const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
// Whole units, not calendar-accurate averages. 365.25 floors two exact years
// to "1 year ago", which is worse than the drift it was correcting for.
const MONTH = 30 * DAY
const YEAR = 365 * DAY

// `always`, not `auto`: `auto` swaps in "yesterday" and "last year", and the
// line this feeds reads "Updated 2 days ago · 3 comments" — a bare
// "yesterday" in that slot loses the parallel with the count beside it.
const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'always' })

const UNITS: [limit: number, size: number, unit: Intl.RelativeTimeFormatUnit][] = [
  [HOUR, MINUTE, 'minute'],
  [DAY, HOUR, 'hour'],
  [MONTH, DAY, 'day'],
  [YEAR, MONTH, 'month'],
  [Infinity, YEAR, 'year']
]

/**
 * "2 days ago", from a PocketBase timestamp.
 *
 * `Intl.RelativeTimeFormat` rather than a date library: this is the only place
 * in the app that needs it, and the pluralisation and wording are the part
 * that would otherwise be hand-rolled and wrong.
 *
 * `now` is a parameter so the thresholds can be tested without freezing the
 * clock.
 */
export function relativeTime(iso: string, now: number = Date.now()): string {
  // PocketBase returns "2026-08-24 09:00:00.000Z", with a space. Safari's
  // Date parser rejects that and yields NaN, so the "T" goes back in — a bug
  // that would only ever show up on an iPhone.
  const then = new Date(iso.trim().replace(' ', 'T')).getTime()
  if (Number.isNaN(then)) return ''

  const elapsed = now - then
  // Negative means the record is stamped in the future, which happens when a
  // device clock runs behind the server's. "in 3 seconds" reads as a bug.
  if (elapsed < MINUTE) return 'just now'

  for (const [limit, size, unit] of UNITS) {
    if (elapsed < limit) return formatter.format(-Math.floor(elapsed / size), unit)
  }
  return ''
}
