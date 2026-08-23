import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClientResponseError } from 'pocketbase'
import { clearApiCache, deriveMembership, signInError, useAuthUser } from '~/composables/useAuth'

const dana = { id: 'u_dana', name: 'Dana Herskowitz', role: 'owner' as const }
const sam = { id: 'u_sam', name: 'Sam Okafor', role: 'member' as const }

describe('deriveMembership', () => {
  it('finds the authed user in the directory', () => {
    expect(deriveMembership('u_sam', [dana, sam])).toEqual(sam)
  })

  it('returns null when the user has no enabled membership', () => {
    expect(deriveMembership('u_nobody', [dana, sam])).toBeNull()
  })

  it('returns null when nobody is logged in', () => {
    expect(deriveMembership('', [dana, sam])).toBeNull()
  })

  it('returns null while the directory is still loading', () => {
    expect(deriveMembership('u_sam', undefined)).toBeNull()
  })
})

// Everything below is about the service worker's `pb-api-storage` cache, which
// is keyed by URL with no auth dimension — see `clearApiCache`.

/** Every call a transition makes, in order — the ordering is the assertion. */
const calls: string[] = []

/**
 * Answer the two requests a sign-in makes, so the real SDK can drive the real
 * `login()`. Stubbing `fetch` rather than the Nuxt app: `$pb` is installed by a
 * plugin as a getter and cannot be replaced, and mocking `useNuxtApp` itself
 * takes Nuxt's own plugins down with it.
 */
function stubFetch() {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input)
    if (url.includes('auth-with-password')) {
      calls.push('authWithPassword')
      return Response.json({ token: 'token-for-dana', record: { ...dana, collectionName: 'users' } })
    }
    if (url.includes('storage_app_users')) {
      calls.push('getFullList')
      return Response.json({ items: [dana], page: 1, perPage: 1000, totalItems: -1, totalPages: -1 })
    }
    throw new Error(`unexpected request: ${url}`)
  })
}

/** A stand-in for the Cache API that records what was deleted. */
function stubCaches(): string[] {
  const deleted: string[] = []
  vi.stubGlobal('caches', {
    delete: async (name: string) => {
      deleted.push(name)
      calls.push(`caches.delete(${name})`)
      return true
    }
  })
  return deleted
}

describe('clearApiCache', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    calls.length = 0
  })

  it('deletes the PocketBase response cache', async () => {
    const deleted = stubCaches()
    await clearApiCache()
    expect(deleted).toEqual(['pb-api-storage'])
  })

  it('does nothing where the Cache API is unavailable', async () => {
    vi.stubGlobal('caches', undefined)
    await expect(clearApiCache()).resolves.toBeUndefined()
  })
})

describe('auth transitions clear the API cache', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    calls.length = 0
    useNuxtApp().$pb.authStore.clear()
  })

  it('clears it on sign-in, before the membership directory is read', async () => {
    stubCaches()
    stubFetch()
    await useAuthUser().login('dana@local.test', 'storagedev123')
    // Ordering is the point: the directory read goes through the worker too, so
    // clearing after it would still let a poisoned entry reject a real member.
    expect(calls).toEqual(['caches.delete(pb-api-storage)', 'authWithPassword', 'getFullList'])
  })

  it('clears it on sign-out, so the next user is not served this one', async () => {
    const deleted = stubCaches()
    await useAuthUser().logout()
    expect(deleted).toEqual(['pb-api-storage'])
  })

  it('signs out without throwing where the Cache API is unavailable', async () => {
    vi.stubGlobal('caches', undefined)
    await expect(useAuthUser().logout()).resolves.toBeUndefined()
  })
})

describe('signInError', () => {
  it('replaces PocketBase wording for a rejected sign-in', () => {
    const rejected = new ClientResponseError({
      status: 400,
      response: { message: 'Failed to authenticate.', data: {} }
    })
    const replaced = signInError(rejected)
    expect(replaced).toBeInstanceOf(Error)
    expect(pbError(replaced)).toBe(
      'We could not sign you in. Check your email and password, then try again.'
    )
  })

  it('says the same thing whether the password is wrong or the account is unknown', () => {
    // PocketBase answers both with an identical 400, and so must we — the
    // message must not become an oracle for which addresses have accounts.
    const wrongPassword = new ClientResponseError({
      status: 400,
      response: { message: 'Failed to authenticate.', data: {} }
    })
    const noSuchUser = new ClientResponseError({
      status: 400,
      response: { message: 'Failed to authenticate.', data: {} }
    })
    expect(pbError(signInError(wrongPassword))).toBe(pbError(signInError(noSuchUser)))
  })

  it('leaves a server failure alone rather than blaming the password', () => {
    const down = new ClientResponseError({
      status: 500,
      response: { message: 'Something went wrong while processing your request.', data: {} }
    })
    expect(signInError(down)).toBe(down)
  })

  it('leaves an offline failure alone', () => {
    // The SDK reports a dead network as status 0.
    const offline = new ClientResponseError({ status: 0, originalError: new Error('Failed to fetch') })
    expect(signInError(offline)).toBe(offline)
  })
})
