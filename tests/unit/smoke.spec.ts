import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import index from '~/pages/index.vue'

describe('test harness', () => {
  it('renders a page inside the nuxt environment', async () => {
    const page = await mountSuspended(index)
    expect(page.text()).toContain('Storage Boxes')
  })
})
