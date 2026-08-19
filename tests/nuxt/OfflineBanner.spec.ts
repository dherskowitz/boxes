import { describe, expect, it } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import OfflineBanner from '~/components/OfflineBanner.vue'

const isOnline = ref(true)
mockNuxtImport('useOnline', () => {
  return () => ({ isOnline })
})

describe('OfflineBanner', () => {
  it('renders when offline', async () => {
    isOnline.value = false
    const banner = await mountSuspended(OfflineBanner)
    expect(banner.find('[data-testid="offline-banner"]').exists()).toBe(true)
    expect(banner.text()).toMatch(/browse what you have already viewed/i)
  })

  it('does not render when online', async () => {
    isOnline.value = true
    const banner = await mountSuspended(OfflineBanner)
    expect(banner.find('[data-testid="offline-banner"]').exists()).toBe(false)
  })
})
