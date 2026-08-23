/**
 * Reporting queries over the `storage_report_*` view collections.
 *
 * Owned by the reporting slice. Aggregation happens in PocketBase — these views
 * return tens of rows. Never fetch full record sets and reduce them here.
 */
import type { ReportBoxFill, ReportGrowth, ReportTagUsage } from '~/types/pocketbase'
import { keys } from '~/queries/keys'

export interface ReportTotalsResult {
  boxes: number
  items: number
  tags: number
  photos: number
}

export interface LocationGroup {
  location: string
  count: number
}

/**
 * Which boxes are crowded. Archived boxes are excluded from this ranking —
 * spec §7.10 item 2 — even though they still count toward `reportTotals`.
 */
export function topBoxesByItems(
  boxFill: ReportBoxFill[] | undefined,
  limit: number
): ReportBoxFill[] {
  return (boxFill ?? [])
    .filter(box => box.status === 'active')
    // Array.prototype.sort is stable since ES2019, so ties keep the view's
    // original row order deterministically — no secondary key needed.
    .sort((a, b) => b.item_count - a.item_count)
    .slice(0, limit)
}

/**
 * Boxes grouped by location, for the locations donut. The one permitted
 * client-side grouping (spec §7.10 item 3) — `boxFill` is already tens of
 * rows, not the underlying item/box tables.
 */
export function groupByLocation(boxFill: ReportBoxFill[] | undefined): LocationGroup[] {
  const counts = new Map<string, number>()
  for (const box of boxFill ?? []) {
    const location = box.location.trim() === '' ? 'No location' : box.location
    counts.set(location, (counts.get(location) ?? 0) + 1)
  }
  return [...counts.entries()].map(([location, count]) => ({ location, count }))
}

/** Ranks tags by combined box and item usage — spec §7.10 item 4. */
export function topTagsByUsage(
  tagUsage: ReportTagUsage[] | undefined,
  limit: number
): ReportTagUsage[] {
  return [...(tagUsage ?? [])]
    .sort((a, b) => b.box_count + b.item_count - (a.box_count + a.item_count))
    .slice(0, limit)
}

/**
 * Collection-wide totals. Unlike `topBoxesByItems`, archived boxes ARE
 * counted here — spec §7.10 item 1 draws the totals/ranking line deliberately.
 */
export function reportTotals(
  boxFill: ReportBoxFill[] | undefined,
  tagUsage: ReportTagUsage[] | undefined
): ReportTotalsResult {
  const boxes = boxFill ?? []
  const tags = tagUsage ?? []
  return {
    boxes: boxes.length,
    items: boxes.reduce((sum, box) => sum + box.item_count, 0),
    tags: tags.length,
    photos: boxes.reduce((sum, box) => sum + box.photo_count, 0)
  }
}

/** One row per box: title, location, status, item_count, photo_count. */
export function useBoxFill() {
  const { $pb } = useNuxtApp()
  return useQuery({
    queryKey: keys.reports.boxFill(),
    queryFn: () => $pb.collection('storage_report_box_fill').getFullList<ReportBoxFill>({ sort: 'title' })
  })
}

/** One row per tag: name, color, box_count, item_count. */
export function useTagUsage() {
  const { $pb } = useNuxtApp()
  return useQuery({
    queryKey: keys.reports.tagUsage(),
    queryFn: () => $pb.collection('storage_report_tag_usage').getFullList<ReportTagUsage>({ sort: 'name' })
  })
}

/** One row per month, already ordered ascending by the view — do not re-sort. */
export function useGrowth() {
  const { $pb } = useNuxtApp()
  return useQuery({
    queryKey: keys.reports.growth(),
    queryFn: () => $pb.collection('storage_report_growth').getFullList<ReportGrowth>()
  })
}

/**
 * Item count per box, indexed by box id — for the "9 items" chip the v2 design
 * puts on every box card and hero.
 *
 * Built on `useBoxFill()` rather than counting items per card: one cached
 * request of tens of rows, shared with the dashboard and /reports, instead of
 * a request per card. Same pattern as `useTagUsageMap()`.
 */
export function useBoxItemCounts() {
  const { data } = useBoxFill()
  return computed(() => {
    const map = new Map<string, number>()
    for (const row of data.value ?? []) map.set(row.id, row.item_count)
    return map
  })
}
