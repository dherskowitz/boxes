import { describe, expect, it } from 'vitest'
import { grantableUsers } from '~/queries/permissions'
import type { AppUser, StorageBoxPermission } from '~/types/pocketbase'

const dir: AppUser[] = [
  { id: 'u_dana', name: 'Dana Herskowitz', role: 'owner' },
  { id: 'u_sam', name: 'Sam Okafor', role: 'member' },
  { id: 'u_rae', name: 'Rae Lindqvist', role: 'member' }
]
const grant = (user: string): StorageBoxPermission => ({
  id: 'p1', created: '', updated: '', box: 'box1', user, role: 'editor'
})

describe('grantableUsers', () => {
  it('excludes the creator, who already has full rights', () => {
    expect(grantableUsers(dir, [], 'u_dana').map(u => u.id)).toEqual(['u_sam', 'u_rae'])
  })

  it('excludes a user who already holds a grant', () => {
    expect(grantableUsers(dir, [grant('u_sam')], 'u_dana').map(u => u.id)).toEqual(['u_rae'])
  })

  it('excludes a user whose row has an unset role, which appears in no list', () => {
    // `role` is not required, so a grant can come back `''`. Such a row shows
    // in neither the editors list nor here — offering that user again would
    // write a second row for the same user and box.
    expect(grantableUsers(dir, [{ ...grant('u_sam'), role: '' }], 'u_dana').map(u => u.id))
      .toEqual(['u_rae'])
  })

  it('returns nobody when everyone already has access', () => {
    expect(grantableUsers(dir, [grant('u_sam'), grant('u_rae')], 'u_dana')).toEqual([])
  })

  it('handles the directory still loading', () => {
    expect(grantableUsers(undefined, [], 'u_dana')).toEqual([])
  })

  it('handles permissions still loading by granting nobody, rather than offering a duplicate', () => {
    expect(grantableUsers(dir, undefined, 'u_dana')).toEqual([])
  })
})
