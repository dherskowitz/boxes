import { describe, expect, it } from 'vitest'
import { ClientResponseError } from 'pocketbase'
import { pbError } from '~/utils/pbError'

describe('pbError', () => {
  it('joins per-field validation messages', () => {
    const err = new ClientResponseError({
      status: 400,
      response: {
        message: 'Failed to create record.',
        data: {
          title: { code: 'validation_required', message: 'Cannot be blank.' },
          qr_id: { code: 'validation_not_unique', message: 'Value must be unique.' }
        }
      }
    })
    expect(pbError(err)).toBe('title: Cannot be blank.; qr_id: Value must be unique.')
  })

  it('explains a 403 as a permission problem and keeps the server message', () => {
    const err = new ClientResponseError({
      status: 403,
      response: { message: 'Only superusers can perform this action.', data: {} }
    })
    expect(pbError(err)).toBe(
      'You do not have permission to do that. Only superusers can perform this action.'
    )
  })

  it('falls back to the bare explanation when a 403 carries no server message', () => {
    const err = new ClientResponseError({ status: 403, response: { data: {} } })
    expect(pbError(err)).toBe('You do not have permission to do that.')
  })

  it('falls back to the top-level message when there are no field errors', () => {
    const err = new ClientResponseError({
      status: 400,
      response: { message: 'Something failed.', data: {} }
    })
    expect(pbError(err)).toBe('Something failed.')
  })

  it('handles a plain Error', () => {
    expect(pbError(new Error('offline'))).toBe('offline')
  })

  it('handles a thrown non-Error', () => {
    expect(pbError('nope')).toBe('Something went wrong.')
  })
})
