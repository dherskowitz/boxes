import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ReportGrowth from '~/components/ReportGrowth.vue'
import ReportItemsPerBox from '~/components/ReportItemsPerBox.vue'
import ReportLocations from '~/components/ReportLocations.vue'
import ReportTagUsage from '~/components/ReportTagUsage.vue'

/**
 * The seeded fixture always has data (CLAUDE.md, wave-1 plan Task 5), so
 * these empty states never get exercised by the e2e suite against the
 * worktree's seeded PocketBase. Rather than wiping the shared, dedicated
 * e2e instance mid-suite — risky the moment the full suite runs multiple
 * spec files in parallel workers — or modifying `scripts/pb-seed.py` (not
 * owned by this slice), these mount each Report* component directly with
 * empty props and assert its empty-state markup renders. That is a genuine
 * DOM-level proof of the empty branch, just below the PocketBase boundary.
 *
 * Deliberately not mounting the non-empty (chart-rendering) branch here: it's
 * already covered end-to-end by tests/e2e/reports.spec.ts, and mounting
 * nuxt-charts' Unovis-backed components in this vitest+happy-dom environment
 * leaves a dangling animation timer that fires after the test tears down,
 * failing the run with an unrelated "Cannot read properties of undefined
 * (reading '_idleNext')" even though every assertion passes. The empty
 * branch never touches BarChart/DonutChart/AreaChart, so it doesn't hit that.
 */
describe('report chart empty states', () => {
  it('items per box: shows the empty state with no boxes', async () => {
    const wrapper = await mountSuspended(ReportItemsPerBox, { props: { boxFill: [] } })
    expect(wrapper.find('[data-testid="items-per-box-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="items-per-box-chart"]').exists()).toBe(false)
  })

  it('tag usage: shows the empty state with no tags', async () => {
    const wrapper = await mountSuspended(ReportTagUsage, { props: { tagUsage: [] } })
    expect(wrapper.find('[data-testid="tag-usage-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tag-usage-chart"]').exists()).toBe(false)
  })

  it('locations: shows the empty state with no boxes', async () => {
    const wrapper = await mountSuspended(ReportLocations, { props: { boxFill: [] } })
    expect(wrapper.find('[data-testid="locations-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="locations-chart"]').exists()).toBe(false)
  })

  it('growth: shows the empty state with no history', async () => {
    const wrapper = await mountSuspended(ReportGrowth, { props: { growth: [] } })
    expect(wrapper.find('[data-testid="growth-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="growth-chart"]').exists()).toBe(false)
  })
})
