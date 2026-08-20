// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: false,

  modules: [
    '@nuxt/ui',
    '@nuxt/icon',
    '@nuxt/eslint',
    '@peterbud/nuxt-query',
    '@vite-pwa/nuxt',
    'nuxt-charts'
  ],

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    public: {
      // NUXT_PUBLIC_POCKETBASE_URL
      pocketbaseUrl: ''
    }
  },

  nuxtQuery: {
    autoImports: ['useQuery', 'useMutation', 'useQueryClient'],

    queryClientOptions: {
      defaultOptions: {
        mutations: {
          // TanStack's default mutation networkMode is 'online', which *pauses*
          // a mutation while offline: `mutationFn` never runs and the promise
          // never settles, so the button stays stuck loading with no message —
          // exactly the silent failure PRD §7.8 forbids. 'always' runs the
          // function so `assertOnline()` can throw immediately with a message
          // the user can act on. Queries keep the default: a paused query still
          // serves its cached data, which is the offline read v1 does support.
          networkMode: 'always'
        }
      }
    }
  },

  // `composables/` and `utils/` are scanned by default; `queries/` is not.
  // Every query module is consumed like a composable, so scan it too —
  // recursively, so `queries/reports/growth.ts` is picked up as well.
  imports: {
    dirs: ['queries/**']
  },

  app: {
    head: {
      link: [
        // The .ico is picked up implicitly; these are the ones that are not.
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' }
      ]
    }
  },

  // `nuxt build` with `ssr: false` emits no index.html, which leaves the service
  // worker's `navigateFallback: '/'` bound to a URL that was never precached —
  // offline navigation then dies in production while passing every local test.
  // Prerendering `/` makes an ordinary `pnpm build` produce a working shell, so
  // the offline guarantee does not depend on remembering to run `pnpm generate`.
  nitro: {
    prerender: {
      routes: ['/']
    }
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Storage Boxes',
      short_name: 'Storage',
      description: 'Track what is in your storage boxes',
      // Brand kit: yellow lid on charcoal, warm off-white ground.
      theme_color: '#F2C94C',
      background_color: '#F7F5F0',
      display: 'standalone',
      start_url: '/',
      // Android will not offer to install without 192 and 512 (PRD §7.9).
      // Maskable entries are separate: a `purpose: 'any'` icon gets cropped by
      // the launcher's mask, so the maskable exports carry their own safe-zone
      // padding. Dark variants are deliberately omitted — installed PWA icons
      // do not reliably follow the colour scheme across platforms.
      icons: [
        { src: '/icons/icon-72x72.png', sizes: '72x72', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/maskable-icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
        { src: '/icons/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    },
    workbox: {
      // SPA: every unknown route falls back to the app shell
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      runtimeCaching: [
        {
          // Every storage_* collection (boxes, items, comments, tags,
          // permissions, and — critically — the storage_app_users
          // membership directory the layout gates every page on). Matched
          // on URL shape, not a hardcoded host: the PocketBase origin
          // differs between dev and production. Deliberately does NOT
          // match /api/collections/users/auth-with-password, so the auth
          // endpoint always hits the network — caching it would be a
          // security problem, not a feature.
          // Anchored at the origin on purpose: Workbox skips a RegExp route
          // for a cross-origin request unless the pattern matches from the
          // start of the full URL, and PocketBase is always a different
          // origin from the app. An unanchored pattern silently caches
          // nothing.
          urlPattern: /^https?:\/\/[^/]+\/api\/collections\/storage_[^/]+\/records/,
          handler: 'StaleWhileRevalidate',
          method: 'GET',
          options: {
            cacheName: 'pb-api-storage',
            cacheableResponse: { statuses: [0, 200] }
          }
        },
        {
          // PocketBase file storage (box/item images).
          urlPattern: /^https?:\/\/[^/]+\/api\/files\//,
          handler: 'CacheFirst',
          method: 'GET',
          options: {
            cacheName: 'pb-files',
            expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            cacheableResponse: { statuses: [0, 200] }
          }
        }
      ]
    },
    devOptions: { enabled: true, type: 'module' }
  }
})
