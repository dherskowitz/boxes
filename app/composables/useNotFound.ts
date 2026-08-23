import { ClientResponseError } from 'pocketbase'

/**
 * A PocketBase 404.
 *
 * It means the record is not there — or that an API rule filtered it out of
 * the lookup, which PocketBase reports identically (see CLAUDE.md). Both are
 * "this address goes nowhere" as far as the reader is concerned.
 *
 * Exported separately from `useNotFound` so it can be unit tested without a
 * PocketBase instance or a Vue component tree.
 */
export function isNotFoundError(e: unknown): boolean {
  return e instanceof ClientResponseError && e.status === 404
}

/**
 * Escalate a missing record to the app's own 404 screen.
 *
 * A wrong item id is the same class of mistake as a wrong URL, so it deserves
 * the same answer: `app/error.vue`, which names the case ("a box, an item or a
 * screen") and offers the dashboard and the scanner as ways out. A bare "Item
 * not found." line under the app chrome offered neither.
 *
 * `suppress` covers the one 404 that is not a wrong address. Deleting a record
 * invalidates its own detail query, so the query refetches and 404s while the
 * user is still standing on the page, a tick before the redirect lands — pass
 * a flag that is true for that window or every successful delete ends on the
 * error screen.
 */
export function useNotFound<T>(error: Ref<T>, suppress?: Ref<boolean>) {
  watch(error, (e) => {
    if (suppress?.value) return
    if (isNotFoundError(e)) showError(createError({ statusCode: 404 }))
  }, { immediate: true })
}
