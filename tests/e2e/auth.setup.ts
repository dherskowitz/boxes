import { expect, test as setup } from '@playwright/test'

const ACCOUNTS = [
  { role: 'dana', email: 'dana@local.test' },
  { role: 'sam', email: 'sam@local.test' },
  { role: 'rae', email: 'rae@local.test' }
  // No `nobody` session: login() rejects an account without an enabled
  // app_memberships row, so that account can no longer hold one.
] as const

for (const { role, email } of ACCOUNTS) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    // The 45s expect below has to fit inside the test timeout alongside
    // /login's own cold compile, which the config's 60s does not comfortably
    // allow. reports.spec.ts and dashboard.spec.ts already raise theirs; this
    // is the file whose failure costs all 112 tests, so it gets the most room.
    setup.setTimeout(150_000)
    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('storagedev123')
    await page.getByRole('button', { name: 'Sign in' }).click()
    // 45s, not the 15s default, for the same reason auth.spec.ts's guard loop
    // uses it: signing in lands on `/`, which since v1.2 is the dashboard and
    // pulls in nuxt-charts' Unovis graph. On a cold dev server that first
    // compile sits right on the 15s boundary, and the whole suite depends on
    // this file — a flake here means 112 tests never run.
    await expect(page).toHaveURL('/', { timeout: 45_000 })
    await page.context().storageState({ path: `tests/e2e/.auth/${role}.json` })
  })
}
