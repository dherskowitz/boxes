import { ClientResponseError } from 'pocketbase'
import { describe, expect, it } from 'vitest'
import { isNotFoundError } from '~/composables/useNotFound'

describe('isNotFoundError', () => {
  it('recognises a missing record', () => {
    expect(isNotFoundError(new ClientResponseError({ status: 404 }))).toBe(true)
  })

  it('recognises a record an API rule filtered out of the lookup', () => {
    // PocketBase applies update/delete/view rules as a filter on the lookup, so
    // a record the user may not touch is reported as absent, not forbidden.
    const filtered = new ClientResponseError({
      status: 404,
      response: { message: "The requested resource wasn't found.", data: {} }
    })
    expect(isNotFoundError(filtered)).toBe(true)
  })

  it('leaves a permission failure alone', () => {
    expect(isNotFoundError(new ClientResponseError({ status: 403 }))).toBe(false)
  })

  it('leaves an offline failure alone', () => {
    // The SDK reports a dead network as status 0. Escalating that to the 404
    // screen would tell someone their box is gone when it is only unreachable.
    expect(isNotFoundError(new ClientResponseError({ status: 0 }))).toBe(false)
  })

  it('is false while the query has not errored', () => {
    expect(isNotFoundError(null)).toBe(false)
    expect(isNotFoundError(undefined)).toBe(false)
  })

  it('leaves a plain Error alone', () => {
    expect(isNotFoundError(new Error('404'))).toBe(false)
  })
})
