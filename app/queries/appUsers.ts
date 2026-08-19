import type { AppUser } from '~/types/pocketbase'
import { keys } from '~/queries/keys'

/**
 * Every enabled member of this app.
 *
 * Reads the `storage_app_users` view rather than `users`, because `users` is
 * only readable by the authed user themselves — relation expansion onto it
 * always returns `{}`. The group is small and trusted, so one directory fetch
 * is cheaper than per-record expansion would be.
 */
export function useAppUsers() {
  const { $pb, $pbUser } = useNuxtApp()
  return useQuery({
    queryKey: keys.appUsers.list(),
    queryFn: () =>
      $pb.collection('storage_app_users').getFullList<AppUser>({ sort: 'name' }),
    // Without a session this returns an empty set rather than an error, so
    // firing it on the login page would just be a pointless request.
    enabled: computed(() => $pbUser.value !== null),
    staleTime: 5 * 60 * 1000
  })
}

/** id → member, for resolving comment authors and creator labels. */
export function useAppUserMap() {
  const { data } = useAppUsers()
  return computed(() => new Map((data.value ?? []).map(u => [u.id, u])))
}
