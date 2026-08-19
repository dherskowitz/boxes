import { describe, expect, it } from 'vitest'
import { deriveMembership } from '~/composables/useAuth'

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
