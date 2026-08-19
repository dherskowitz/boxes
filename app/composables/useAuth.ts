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

export function useAuth() {
  const { $pb, $pbUser } = useNuxtApp()

  const userId = computed(() => $pbUser.value?.id ?? '')
  const isLoggedIn = computed(() => userId.value !== '')

  const { data: directory, isPending: isMembershipPending } = useAppUsers()
  const member = computed(() => deriveMembership(userId.value, directory.value))
  const role = computed(() => member.value?.role ?? null)
  const isMember = computed(() => member.value !== null)

  async function login(email: string, password: string) {
    await $pb.collection('users').authWithPassword(email, password)
  }

  function logout() {
    $pb.authStore.clear()
  }

  return {
    user: $pbUser,
    userId,
    isLoggedIn,
    member,
    role,
    isMember,
    isMembershipPending,
    login,
    logout
  }
}
