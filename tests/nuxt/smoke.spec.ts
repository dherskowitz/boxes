import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import index from '~/pages/index.vue'

describe('test harness', () => {
  it('renders a page inside the nuxt environment', async () => {
    // This was a wave-0 placeholder assertion against index.vue's old stub
    // content ("Storage Boxes"). Slice A replaced that stub with the real box
    // index page, so the smoke test now checks its heading instead — the
    // point of this test is only that the Nuxt test harness can mount a page,
    // not what that page contains.
    const page = await mountSuspended(index)
    expect(page.text()).toContain('Boxes')
  })
})
