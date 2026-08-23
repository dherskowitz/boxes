import { ClientResponseError } from 'pocketbase'
import type { AppUser } from '~/types/pocketbase'

const NO_APP_ACCESS
  = 'Your account is not an enabled member of Storage Boxes. Ask an admin to grant you access.'

const SIGN_IN_FAILED
  = 'We could not sign you in. Check your email and password, then try again.'

/**
 * Replace PocketBase's wording for a rejected sign-in.
 *
 * The auth endpoint answers every bad sign-in with the same 400 and the same
 * `Failed to authenticate.` — backend phrasing, and deliberately identical for
 * a wrong password and an address with no account, so the message can never be
 * used to find out who has one. Keep that property; only the wording changes.
 *
 * A 400 is the only rejection this endpoint issues, so anything else — offline
 * (status 0), a 5xx — keeps its own message. Telling someone to check their
 * password while the server is down sends them hunting for a typo that is not
 * there, which is its own kind of silent failure.
 *
 * Exported separately from `useAuth` so it can be unit tested without a
 * PocketBase instance or a Vue component tree.
 */
export function signInError(e: unknown): unknown {
  return e instanceof ClientResponseError && e.status === 400 ? new Error(SIGN_IN_FAILED) : e
}

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

/** The service worker cache holding every `storage_*` list response. */
const API_CACHE = 'pb-api-storage'

/**
 * Drop the service worker's cache of PocketBase responses.
 *
 * That cache is keyed by URL alone, with no auth dimension, so on a shared
 * device one user's boxes, items and member directory are served to the next —
 * until revalidation catches up, and indefinitely while offline. Clearing it on
 * both auth transitions is what stops that: on sign-out so nothing of this
 * user's is left behind, and on sign-in so anything cached without a session is
 * discarded before the membership gate reads it.
 *
 * No-ops where the Cache API is unavailable — a non-secure context, an older
 * browser, or the unit test environment — because neither transition may fail
 * over a cache that was never there.
 */
export async function clearApiCache(): Promise<void> {
  if (typeof caches === 'undefined') return
  await caches.delete(API_CACHE)
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
    // Before anything reads the directory, not after: the service worker sits
    // below the SDK, so the deliberate read-past-nuxt-query below is served
    // from `pb-api-storage` too — and an entry cached without a session would
    // reject this account as a non-member.
    await clearApiCache()
    const { record } = await $pb.collection('users')
      .authWithPassword(email, password)
      .catch((e: unknown) => {
        throw signInError(e)
      })
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

  async function logout() {
    $pb.authStore.clear()
    await clearApiCache()
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
