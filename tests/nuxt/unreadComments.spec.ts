import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { countUnread, markItemRead, useUnreadComments } from '~/composables/useUnreadComments'
import type { StorageComment } from '~/types/pocketbase'

mockNuxtImport('useAuthUser', () => {
  return () => ({ userId: ref('u_rae') })
})

const c = (id: string, created: string, user: string): StorageComment =>
  ({ id, created, updated: created, item: 'i1', user, text: 'x' })

const comments = [
  c('c1', '2026-08-01 10:00:00Z', 'u_sam'),
  c('c2', '2026-08-03 10:00:00Z', 'u_dana'),
  c('c3', '2026-08-05 10:00:00Z', 'u_sam')
]

describe('countUnread', () => {
  it('counts comments newer than the last view', () => {
    expect(countUnread(comments, '2026-08-02 00:00:00Z', 'u_rae')).toBe(2)
  })

  it('never counts your own comments — you just wrote them', () => {
    expect(countUnread(comments, '2026-08-02 00:00:00Z', 'u_sam')).toBe(1)
  })

  it('counts everything when the item has never been viewed', () => {
    expect(countUnread(comments, null, 'u_rae')).toBe(3)
  })

  it('counts nothing when everything predates the last view', () => {
    expect(countUnread(comments, '2026-09-01 00:00:00Z', 'u_rae')).toBe(0)
  })

  it('handles comments still loading', () => {
    expect(countUnread(undefined, null, 'u_rae')).toBe(0)
  })
})

// happy-dom in the Nuxt test environment exposes no `localStorage` at all, so
// these stub one in: a Map-backed stub for the working case, and a throwing
// one for the browser that refuses storage.
function stubWorkingStorage(): Map<string, string> {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value) }
  })
  return store
}

function stubBlockedStorage(): void {
  const refuse = () => { throw new Error('The operation is insecure.') }
  vi.stubGlobal('localStorage', { getItem: refuse, setItem: refuse })
}

describe('useUnreadComments', () => {
  const fromSam = [c('c9', '2026-08-05 10:00:00Z', 'u_sam')]

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows no badge when storage is blocked, rather than one that can never clear', () => {
    // Safari private browsing, or a managed browser: the read throws, and so
    // does the write that would clear the badge. Treating the failed read as
    // "never viewed" pins the full count of other people's comments on
    // permanently, with nothing able to clear it.
    stubBlockedStorage()

    expect(useUnreadComments(ref('i_peacoat'), ref(fromSam)).value).toBe(0)
  })

  it('counts against the stored marker when storage works', () => {
    const store = stubWorkingStorage()
    store.set('storage-app:item-read:i_peacoat', '2026-08-01T00:00:00.000Z')

    expect(useUnreadComments(ref('i_peacoat'), ref(fromSam)).value).toBe(1)
  })

  it('marks the item read once the thread has resolved', () => {
    const store = stubWorkingStorage()

    useUnreadComments(ref('i_peacoat'), ref(fromSam))

    expect(store.get('storage-app:item-read:i_peacoat')).toBeDefined()
  })

  it('does not mark the item read while the thread is still loading', () => {
    const store = stubWorkingStorage()

    useUnreadComments(ref('i_peacoat'), ref<StorageComment[] | undefined>(undefined))

    expect(store.has('storage-app:item-read:i_peacoat')).toBe(false)
  })

  it('follows the item when navigating item to item without a fresh setup', async () => {
    // /item/a -> /item/b reuses the route record, so neither setup nor mount
    // runs again: the marker has to be re-read and the new item marked read.
    const store = stubWorkingStorage()
    store.set('storage-app:item-read:i_peacoat', '2026-09-01T00:00:00.000Z')
    const itemId = ref('i_peacoat')
    const comments = ref<StorageComment[] | undefined>([])
    const badge = useUnreadComments(itemId, comments)
    expect(badge.value).toBe(0)

    itemId.value = 'i_kettle'
    comments.value = fromSam
    await nextTick()

    expect(badge.value).toBe(1)
    expect(store.get('storage-app:item-read:i_kettle')).toBeDefined()
  })
})

describe('markItemRead', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('stores a parseable timestamp for the item', () => {
    const store = stubWorkingStorage()

    markItemRead('i_peacoat')

    const stored = store.get('storage-app:item-read:i_peacoat') ?? ''
    expect(Number.isNaN(new Date(stored).getTime())).toBe(false)
  })

  it('does not throw when storage refuses the write', () => {
    stubBlockedStorage()

    expect(() => markItemRead('i_peacoat')).not.toThrow()
  })
})
