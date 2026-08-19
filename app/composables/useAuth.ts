import type { AppUser } from '~/types/pocketbase'

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
    await $pb.collection('users').authWithPassword(email, password)
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
