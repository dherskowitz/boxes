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
 * timestamp — no schema change for what is only a badge. A browser with
 * storage disabled (private mode, quota exceeded) degrades to "no badge"
 * rather than crashing the item page.
 */
export function useUnreadComments(itemId: Ref<string>, comments: Ref<StorageComment[] | undefined>) {
  const { userId } = useAuthUser()

  function lastViewed(): string | null {
    try {
      return localStorage.getItem(storageKey(itemId.value))
    } catch {
      return null
    }
  }

  return computed(() => countUnread(comments.value, lastViewed(), userId.value))
}

/** Call when the thread is viewed, to clear the badge. */
export function markItemRead(itemId: string): void {
  try {
    localStorage.setItem(storageKey(itemId), new Date().toISOString())
  } catch {
    // Storage disabled — nothing to persist, badge just won't clear.
  }
}
