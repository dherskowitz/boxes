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
    autoImports: ['useQuery', 'useMutation', 'useQueryClient']
  },

  // `composables/` and `utils/` are scanned by default; `queries/` is not.
  // Every query module is consumed like a composable, so scan it too —
  // recursively, so `queries/reports/growth.ts` is picked up as well.
  imports: {
    dirs: ['queries/**']
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Storage Boxes',
      short_name: 'Storage',
      description: 'Track what is in your storage boxes',
      theme_color: '#ffffff',
      display: 'standalone',
      start_url: '/'
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
