export default defineNuxtRouteMiddleware((to) => {
  const { $pb } = useNuxtApp()
  if (to.path === '/login') return
  if ($pb.authStore.isValid) return

  // Preserve the destination so a QR deep link survives the login round-trip.
  return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
})
