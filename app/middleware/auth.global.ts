export default defineNuxtRouteMiddleware((to) => {
  const { $pb } = useNuxtApp()
  // A signed-in user has no business looking at the login form.
  if (to.path === '/login') return $pb.authStore.isValid ? navigateTo('/') : undefined
  if ($pb.authStore.isValid) return

  // Preserve the destination so a QR deep link survives the login round-trip.
  return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
})
