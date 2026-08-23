// `nav: false` hides the floating nav pill for a screen — see
// `app/layouts/default.vue`. Declared here so `definePageMeta` type-checks it.
declare module 'vue-router' {
  interface RouteMeta {
    nav?: boolean
  }
}

export {}
