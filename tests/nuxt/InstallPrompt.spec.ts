import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import InstallPrompt from '~/components/InstallPrompt.vue'

const STANDALONE_QUERY = '(display-mode: standalone)'

// This test harness's `window` has no real Storage implementation (unlike
// an actual browser), so give it one — the component reads/writes
// `localStorage` directly, as it would in production.
const localStorageStore = new Map<string, string>()
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: (key: string) => localStorageStore.get(key) ?? null,
    setItem: (key: string, value: string) => {
      localStorageStore.set(key, value)
    },
    removeItem: (key: string) => {
      localStorageStore.delete(key)
    },
    clear: () => {
      localStorageStore.clear()
    }
  },
  configurable: true
})

function setUserAgent(ua: string) {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true })
}

const realMatchMedia = window.matchMedia.bind(window)

function setStandalone(isStandalone: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
    if (query === STANDALONE_QUERY) {
      return { ...realMatchMedia(query), matches: isStandalone }
    }
    return realMatchMedia(query)
  })
}

const ANDROID_UA
  = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36'
const IOS_UA
  = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'

/** Dispatch the event the plugin's listener is waiting for. */
function fireInstallPrompt() {
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome: 'accepted' as const })
  })
  window.dispatchEvent(event)
  return event
}

/** The captured event outlives a component, so each test starts without one. */
beforeEach(() => {
  window.localStorage.clear()
  setUserAgent(ANDROID_UA)
  setStandalone(false)
  useInstallPrompt().value = null
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('InstallPrompt', () => {
  it('offers an install button after beforeinstallprompt fires', async () => {
    const prompt = await mountSuspended(InstallPrompt)
    const event = fireInstallPrompt()
    await nextTick()

    expect(prompt.find('[data-testid="install-button"]').exists()).toBe(true)

    await prompt.find('[data-testid="install-button"]').trigger('click')
    expect(event.prompt).toHaveBeenCalled()
  })

  // The event fires once, as soon as the browser has parsed the manifest and
  // found the worker — during the first load, and on a cold visit to /login
  // this component is not mounted at all (that page is `layout: false`). A
  // listener owned by the component is always too late; the plugin's is not.
  it('offers an install button when the event fired before it mounted', async () => {
    const event = fireInstallPrompt()
    const prompt = await mountSuspended(InstallPrompt)

    expect(prompt.find('[data-testid="install-button"]').exists()).toBe(true)

    await prompt.find('[data-testid="install-button"]').trigger('click')
    expect(event.prompt).toHaveBeenCalled()
  })

  it('stops offering once the browser reports the app installed', async () => {
    fireInstallPrompt()
    const prompt = await mountSuspended(InstallPrompt)
    expect(prompt.find('[data-testid="install-button"]').exists()).toBe(true)

    window.dispatchEvent(new Event('appinstalled'))
    await nextTick()

    expect(prompt.find('[data-testid="install-button"]').exists()).toBe(false)
  })

  it('shows an instructional nudge on iOS, which has no install-prompt API', async () => {
    setUserAgent(IOS_UA)
    const prompt = await mountSuspended(InstallPrompt)

    expect(prompt.find('[data-testid="ios-install-hint"]').exists()).toBe(true)
    expect(prompt.text()).toMatch(/share/i)
    expect(prompt.text()).toMatch(/add to home screen/i)
    expect(prompt.find('[data-testid="install-button"]').exists()).toBe(false)
  })

  it('renders nothing when already running installed', async () => {
    setStandalone(true)
    const prompt = await mountSuspended(InstallPrompt)

    expect(prompt.find('[data-testid="install-button"]').exists()).toBe(false)
    expect(prompt.find('[data-testid="ios-install-hint"]').exists()).toBe(false)
  })

  it('stays dismissed after the user dismisses it', async () => {
    setUserAgent(IOS_UA)
    const first = await mountSuspended(InstallPrompt)
    expect(first.find('[data-testid="ios-install-hint"]').exists()).toBe(true)

    await first.find('[data-testid="install-dismiss"]').trigger('click')
    expect(first.find('[data-testid="ios-install-hint"]').exists()).toBe(false)

    const second = await mountSuspended(InstallPrompt)
    expect(second.find('[data-testid="ios-install-hint"]').exists()).toBe(false)
  })
})
