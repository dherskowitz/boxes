import { describe, expect, it, vi } from 'vitest'

const onlineRef = ref(true)
vi.mock('@vueuse/core', () => ({ useOnline: () => onlineRef }))

const { useOnline, assertOnline } = await import('~/composables/useOnline')

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

describe('assertOnline', () => {
  it('throws a connectivity error when offline', () => {
    onlineRef.value = false
    expect(() => assertOnline()).toThrow(/connect/i)
  })

  it('does nothing when online', () => {
    onlineRef.value = true
    expect(() => assertOnline()).not.toThrow()
  })
})
