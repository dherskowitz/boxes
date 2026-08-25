// `nav: false` hides the floating nav pill for a screen, `offlineBanner: false`
// the layout's offline notice, `rail: false` the desktop side rail — see
// `app/layouts/default.vue`. Declared here so `definePageMeta` type-checks them.
declare module 'vue-router' {
  interface RouteMeta {
    nav?: boolean
    offlineBanner?: boolean
    rail?: boolean
  }
}

export {}
