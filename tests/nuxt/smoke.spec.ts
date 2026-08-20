import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import boxes from '~/pages/boxes.vue'

describe('test harness', () => {
  it('renders a page inside the nuxt environment', async () => {
    // This was a wave-0 placeholder assertion against index.vue's old stub
    // content ("Storage Boxes"). Slice A replaced that stub with the real box
    // index page, so the smoke test now checks its heading instead — the
    // point of this test is only that the Nuxt test harness can mount a page,
    // not what that page contains. The box index moved to `boxes.vue` in v1.2;
    // it stays the page this mounts, since `/` is now a dashboard whose value
    // comes from live queries rather than from being simple to mount.
    const page = await mountSuspended(boxes)
    expect(page.text()).toContain('Boxes')
  })
})
