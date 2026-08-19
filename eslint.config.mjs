// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    // Generated PocketBase migrations run in goja with their own globals
    // (migrate, Record, $app) and are not part of the app source.
    ignores: ['pb_migrations/**']
  }
)
