// `nav: false` hides the floating nav pill for a screen, `offlineBanner: false`
// the layout's offline notice — see `app/layouts/default.vue`. Declared here so
// `definePageMeta` type-checks them.
declare module 'vue-router' {
  interface RouteMeta {
    nav?: boolean
    offlineBanner?: boolean
  }
}

export {}
