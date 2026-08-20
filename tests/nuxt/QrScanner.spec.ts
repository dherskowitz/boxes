import { describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, onMounted } from 'vue'
import QrScanner from '~/components/QrScanner.vue'

// Live camera scanning cannot be driven in this test environment — the reader
// is stubbed so we can exercise the permission-denied / no-camera states,
// which are real unhappy paths on a phone and must not just show a blank frame.
const { errorToEmit } = vi.hoisted(() => ({ errorToEmit: { value: null as Error | null } }))

vi.mock('vue-qrcode-reader', () => ({
  QrcodeStream: defineComponent({
    emits: ['detect', 'error', 'camera-on', 'camera-off'],
    setup(_, { emit }) {
      onMounted(() => {
        if (errorToEmit.value) emit('error', errorToEmit.value)
      })
      return () => null
    }
  })
}))

function makeError(name: string, message: string): Error {
  const error = new Error(message)
  error.name = name
  return error
}

describe('QrScanner', () => {
  it('tells the user how to proceed when camera permission is denied', async () => {
    errorToEmit.value = makeError('NotAllowedError', 'Permission denied')
    const wrapper = await mountSuspended(QrScanner)
    expect(wrapper.find('[data-testid="scanner-permission-denied"]').exists()).toBe(true)
  })

  it('shows a clear message when the device has no camera', async () => {
    errorToEmit.value = makeError('NotFoundError', 'Requested device not found')
    const wrapper = await mountSuspended(QrScanner)
    expect(wrapper.find('[data-testid="scanner-no-camera"]').exists()).toBe(true)
  })

  it('surfaces any other camera error rather than showing a blank frame', async () => {
    errorToEmit.value = makeError('AbortError', 'Something odd happened')
    const wrapper = await mountSuspended(QrScanner)
    expect(wrapper.find('[data-testid="scanner-error"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Something odd happened')
  })
})
