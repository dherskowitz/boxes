import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const onlineRef = ref(true)
vi.mock('@vueuse/core', () => ({ useOnline: () => onlineRef }))

const { useOnline } = await import('~/composables/useOnline')

describe('useOnline', () => {
  it('reports the browser state', () => {
    onlineRef.value = true
    expect(useOnline().isOnline.value).toBe(true)
  })

  it('reacts when the browser goes offline', () => {
    onlineRef.value = false
    expect(useOnline().isOnline.value).toBe(false)
  })
})

// assertOnline() must be exercised against the REAL @vueuse/core, not the
// mock above. The mock is exactly what hid the original bug: assertOnline()
// used to call useOnline() (via @vueuse/core), which registers real,
// never-disposed `window` event listeners outside a component's setup(). A
// wholesale module mock can't catch a listener leak in the thing it
// replaces — only a test against the unmocked module can. So this block
// unmocks '@vueuse/core' and re-imports the composable fresh.
describe('assertOnline (real navigator.onLine and @vueuse/core, unmocked)', () => {
  const originalOnLine = Object.getOwnPropertyDescriptor(navigator, 'onLine')
  let assertOnline: () => void

  beforeAll(async () => {
    vi.doUnmock('@vueuse/core')
    vi.resetModules()
    ;({ assertOnline } = await import('~/composables/useOnline'))
  })

  afterAll(() => {
    vi.doMock('@vueuse/core', () => ({ useOnline: () => onlineRef }))
    vi.resetModules()
  })

  afterEach(() => {
    if (originalOnLine) Object.defineProperty(navigator, 'onLine', originalOnLine)
  })

  function setOnLine(value: boolean) {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value })
  }

  it('throws a connectivity error when offline', () => {
    setOnLine(false)
    expect(() => assertOnline()).toThrow(/connect/i)
  })

  it('does not throw when online', () => {
    setOnLine(true)
    expect(() => assertOnline()).not.toThrow()
  })

  it('adds no window event listeners, even called repeatedly', () => {
    setOnLine(true)
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')

    for (let i = 0; i < 50; i++) assertOnline()

    expect(addEventListenerSpy).not.toHaveBeenCalled()
    addEventListenerSpy.mockRestore()
  })
})
