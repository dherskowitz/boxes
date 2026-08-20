import type { StorageComment } from '~/types/pocketbase'

function storageKey(itemId: string): string {
  return `storage-app:item-read:${itemId}`
}

/**
 * Number of comments newer than the last time this item's thread was viewed,
 * excluding the current user's own comments — you don't need a badge telling
 * you about the comment you just wrote.
 *
 * Pure and exported standalone for unit testing without `localStorage` or a
 * component tree.
 */
export function countUnread(
  comments: StorageComment[] | undefined,
  lastViewedIso: string | null,
  currentUserId: string
): number {
  if (!comments) return 0
  // Compared as Date, not string: PocketBase's `created` uses a space
  // separator ('2026-08-19 10:00:00.000Z') while the badge's stored
  // timestamp uses `toISOString()`'s 'T' separator. Those two formats do not
  // sort correctly against each other as strings — 'T' > ' ' — which makes a
  // same-day comment silently vanish from the unread count.
  const lastViewed = lastViewedIso === null ? null : new Date(lastViewedIso).getTime()
  return comments.filter((comment) => {
    if (comment.user === currentUserId) return false
    if (lastViewed === null) return true
    return new Date(comment.created).getTime() > lastViewed
  }).length
}

/**
 * PRD §7.5's in-app new-comment badge, backed by a per-item `localStorage`
 * timestamp — no schema change for what is only a badge. A browser that
 * refuses storage entirely (Safari private browsing, a managed browser with
 * storage blocked) shows no badge at all.
 */
export function useUnreadComments(itemId: Ref<string>, comments: Ref<StorageComment[] | undefined>) {
  const { userId } = useAuthUser()

  // A failed read is not "never viewed": counting it that way pins the badge
  // on permanently, since the write that would clear it throws too. Tracked
  // as a flag so `countUnread` stays pure.
  let storageAvailable = true

  function readLastViewed(): string | null {
    try {
      return localStorage.getItem(storageKey(itemId.value))
    } catch {
      storageAvailable = false
      return null
    }
  }

  // Not read fresh on every recompute: marking the thread read must not
  // retroactively zero out the badge this visit was meant to show. Re-read on
  // navigation instead — item -> item reuses the same route record, so setup
  // never runs again and the badge would keep scoring against the old item.
  const lastViewed = ref(readLastViewed())

  // Marked read here rather than on mount: stamping "read now" while the
  // thread is still loading or errored buries comments the user never saw.
  // `comments` is undefined until the query resolves.
  watch([itemId, comments], ([id, resolved], previous) => {
    if (previous !== undefined && id !== previous[0]) lastViewed.value = readLastViewed()
    if (resolved !== undefined) markItemRead(id)
  }, { immediate: true })

  return computed(() =>
    storageAvailable ? countUnread(comments.value, lastViewed.value, userId.value) : 0
  )
}

/** Call when the thread is viewed, to clear the badge. */
export function markItemRead(itemId: string): void {
  try {
    localStorage.setItem(storageKey(itemId), new Date().toISOString())
  } catch {
    // Storage disabled — nothing to persist, and useUnreadComments shows no
    // badge in that case rather than one that could never clear.
  }
}
