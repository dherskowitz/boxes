import type { ReportBoxFill } from '~/types/pocketbase'

/** As many suggestions as fit a thumb without the row becoming a list. */
const LIMIT = 6

/**
 * Locations already in use, most-used first, for the RECENT affordance on the
 * box form.
 *
 * Typing a location by hand is how the same shelf ends up spelled three ways,
 * and the locations donut on /reports groups on the raw string — so every
 * variant is its own slice of a chart nobody can read. Offering what is already
 * there is cheaper than normalising it afterwards.
 *
 * Fed from `useBoxFill()` rather than a query of its own: that view is tens of
 * rows, already carries `location`, and is already in flight for the box index
 * and the dashboard.
 *
 * Pure so it tests without `$pb` or a component tree.
 */
export function recentLocations(
  boxFill: ReportBoxFill[] | undefined,
  exclude = ''
): string[] {
  // Keyed case-insensitively so "loft" and "Loft" are one shelf, but the value
  // keeps the first spelling seen — a suggestion has to be typeable text, not
  // a lowercased lookup key.
  const seen = new Map<string, { label: string, count: number }>()

  for (const box of boxFill ?? []) {
    const label = box.location.trim()
    // `location` has no schema default, so an unfilled one arrives as ''.
    if (label === '') continue
    const key = label.toLowerCase()
    const entry = seen.get(key)
    if (entry) entry.count += 1
    else seen.set(key, { label, count: 1 })
  }

  seen.delete(exclude.trim().toLowerCase())

  return [...seen.values()]
    // Array.prototype.sort is stable since ES2019, so equal counts keep
    // insertion order. A suggestion row that reshuffles between renders is a
    // moving target for a thumb already on its way down.
    .sort((a, b) => b.count - a.count)
    .slice(0, LIMIT)
    .map(entry => entry.label)
}
