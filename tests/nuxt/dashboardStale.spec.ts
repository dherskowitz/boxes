import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import Dashboard from '~/pages/index.vue'
import type { ReportBoxFill, ReportTagUsage } from '~/types/pocketbase'

/**
 * The staleness notice must be driven by whether the figures on screen came
 * from cache while offline — not shown unconditionally. Offline with nothing
 * cached there is nothing stale to warn about, and a notice that is always
 * there is one people stop reading.
 *
 * The e2e spec covers offline-with-data end to end; this covers the branch it
 * cannot reach, where the queries are still empty. Both figure queries are
 * given empty arrays rather than rows on purpose: an array is `defined`, so it
 * satisfies "has data" without ReportItemsPerBox mounting nuxt-charts, whose
 * Unovis animation timer outlives the test teardown in happy-dom (see
 * reportEmptyStates.spec.ts).
 */
const isOnline = ref(true)
const boxFill = ref<ReportBoxFill[] | undefined>([])
const tagUsage = ref<ReportTagUsage[] | undefined>([])
const figuresPending = ref(false)

mockNuxtImport('useOnline', () => {
  return () => ({ isOnline })
})

mockNuxtImport('useBoxFill', () => {
  return () => ({
    data: boxFill,
    isPending: figuresPending,
    isError: ref(false),
    error: ref(null),
    refetch: vi.fn()
  })
})

mockNuxtImport('useTagUsage', () => {
  return () => ({
    data: tagUsage,
    isPending: figuresPending,
    isError: ref(false),
    error: ref(null),
    refetch: vi.fn()
  })
})

mockNuxtImport('useBoxList', () => {
  return () => ({
    data: ref(undefined),
    isPending: ref(false),
    isError: ref(false),
    error: ref(null)
  })
})

function setState(online: boolean, cached: boolean) {
  isOnline.value = online
  boxFill.value = cached ? [] : undefined
  tagUsage.value = cached ? [] : undefined
  figuresPending.value = !cached
}

describe('dashboard staleness notice', () => {
  it('stays out of the way online', async () => {
    setState(true, true)
    const page = await mountSuspended(Dashboard)
    expect(page.find('[data-testid="dashboard-stale"]').exists()).toBe(false)
  })

  it('warns when the figures on screen came from cache', async () => {
    setState(false, true)
    const page = await mountSuspended(Dashboard)
    expect(page.find('[data-testid="dashboard-stale"]').exists()).toBe(true)
  })

  it('says nothing when offline with nothing cached to be stale', async () => {
    setState(false, false)
    const page = await mountSuspended(Dashboard)
    expect(page.find('[data-testid="dashboard-stale"]').exists()).toBe(false)
    expect(page.find('[data-testid="dashboard-loading"]').exists()).toBe(true)
  })
})
