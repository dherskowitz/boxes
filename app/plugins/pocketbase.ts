import PocketBase from 'pocketbase'

export default defineNuxtPlugin(() => {
  const pb = new PocketBase(useRuntimeConfig().public.pocketbaseUrl)
  return { provide: { pb } }
})
