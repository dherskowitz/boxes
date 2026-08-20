import type { AppUser } from '~/types/pocketbase'

const NO_APP_ACCESS
  = 'Your account is not an enabled member of Storage Boxes. Ask an admin to grant you access.'

/**
 * Match the authed user against the member directory.
 *
 * Exported separately from `useAuth` so it can be unit tested without a
 * PocketBase instance or a Vue component tree.
 */
export function deriveMembership(
  userId: string,
  directory: AppUser[] | undefined
): AppUser | null {
  if (!userId || !directory) return null
  return directory.find(u => u.id === userId) ?? null
}

/**
 * Identity only: who is signed in, plus sign in/out.
 *
 * Opens no query, so this is safe to call anywhere — inside a submit handler,
 * a `watch`, or any other non-setup context. Use this (not `useAuth`) to read
 * `userId` for the `created_by` / `user` ownership field on create.
 */
export function useAuthUser() {
  const { $pb, $pbUser } = useNuxtApp()

  const userId = computed(() => $pbUser.value?.id ?? '')
  const isLoggedIn = computed(() => userId.value !== '')

  async function login(email: string, password: string) {
    const { record } = await $pb.collection('users').authWithPassword(email, password)
    try {
      // Read straight from PocketBase, NOT through nuxt-query like every other
      // read in this app. This gate decides whether a session exists at all, so
      // a cached directory is exactly what would let a user whose membership was
      // revoked back in — and there is nothing useful to answer offline either.
      // Do not "fix" this back through useAppUsers().
      const directory = await $pb.collection('storage_app_users').getFullList<AppUser>()
      if (!deriveMembership(record.id, directory)) throw new Error(NO_APP_ACCESS)
    } catch (e) {
      // Fail closed: an unverifiable membership leaves no session behind.
      $pb.authStore.clear()
      throw e
    }
  }

  function logout() {
    $pb.authStore.clear()
  }

  return { user: $pbUser, userId, isLoggedIn, login, logout }
}

/**
 * Identity plus this app's membership row.
 *
 * Calls `useAppUsers()`, so it must run inside a component `setup()` (or a
 * composable called from one) — calling it from an event handler throws inside
 * vue-query. Reach for `useAuthUser()` there instead.
 */
export function useAuth() {
  const auth = useAuthUser()

  const {
    data: directory,
    isPending: isMembershipPending,
    isError: isMembershipError,
    error: membershipError,
    refetch: refetchMembership
  } = useAppUsers()

  const member = computed(() => deriveMembership(auth.userId.value, directory.value))
  const role = computed(() => member.value?.role ?? null)
  const isMember = computed(() => member.value !== null)

  return {
    ...auth,
    member,
    role,
    isMember,
    isMembershipPending,
    isMembershipError,
    membershipError,
    refetchMembership
  }
}
