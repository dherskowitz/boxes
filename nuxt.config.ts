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
  // Every query module is consumed like a composable, so scan it too.
  imports: {
    dirs: ['queries']
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
      globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}']
    },
    devOptions: { enabled: true, type: 'module' }
  }
})
