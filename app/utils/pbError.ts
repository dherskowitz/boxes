import { ClientResponseError } from 'pocketbase'

interface FieldError {
  message: string
}

function isFieldError(value: unknown): value is FieldError {
  return (
    typeof value === 'object'
    && value !== null
    && 'message' in value
    && typeof Reflect.get(value, 'message') === 'string'
  )
}

/**
 * Turn anything thrown by a PocketBase call into a message worth showing a user.
 *
 * A 403 nearly always means an API rule rejected the payload — check the
 * ownership-field rules before assuming a bug (see CLAUDE.md).
 */
export function pbError(e: unknown): string {
  if (e instanceof ClientResponseError) {
    const fields = Object.entries(e.response?.data ?? {}).flatMap(([field, detail]) =>
      isFieldError(detail) ? [`${field}: ${detail.message}`] : []
    )
    if (fields.length > 0) return fields.join('; ')
    if (e.status === 403) {
      // Keep the server's wording — on this app a 403 is almost always an
      // ownership-field mistake, and PocketBase names the rule that rejected it.
      const detail = e.response?.message
      return detail
        ? `You do not have permission to do that. ${detail}`
        : 'You do not have permission to do that.'
    }
    return e.response?.message || e.message
  }
  if (e instanceof Error) return e.message
  return 'Something went wrong.'
}
