import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    include: ['tests/unit/**/*.spec.ts'],
    globals: true,
    // mounting the full Nuxt app (PWA + PocketBase plugins) is slow in happy-dom
    testTimeout: 30_000
  }
})
