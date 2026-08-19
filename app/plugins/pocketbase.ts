import PocketBase from 'pocketbase'

export default defineNuxtPlugin(() => {
  const pb = new PocketBase(useRuntimeConfig().public.pocketbaseUrl)

  // One subscription for the app's lifetime. `useAuth()` reads this ref rather
  // than registering its own listener per call site.
  const pbUser = ref(pb.authStore.record)
  pb.authStore.onChange(() => {
    pbUser.value = pb.authStore.record
  })

  return { provide: { pb, pbUser } }
})
