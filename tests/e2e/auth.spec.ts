import { expect, test } from '@playwright/test'

test.describe('unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('redirects to login and preserves the intended destination', async ({ page }) => {
    await page.goto('/box/seedbox1')
    await expect(page).toHaveURL(/\/login\?redirect=/)
    // Vue Router's default query encoder leaves `/` unescaped (it's a legal
    // query character per RFC 3986), so assert the decoded value rather than
    // a specific percent-encoding.
    expect(new URL(page.url()).searchParams.get('redirect')).toBe('/box/seedbox1')
  })

  test('returns to the deep link after signing in', async ({ page }) => {
    await page.goto('/box/seedbox1')
    await page.getByLabel('Email').fill('dana@local.test')
    await page.getByLabel('Password').fill('storagedev123')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/box/seedbox1')
    // Prove a working box screen is reached, not just a surviving URL.
    await expect(page.getByText('Winter coats and boots')).toBeVisible()
  })

  for (const hostile of ['https://evil.example', '//evil.example']) {
    test(`ignores the external redirect target ${hostile}`, async ({ page }) => {
      await page.goto(`/login?redirect=${encodeURIComponent(hostile)}`)
      await page.getByLabel('Email').fill('dana@local.test')
      await page.getByLabel('Password').fill('storagedev123')
      await page.getByRole('button', { name: 'Sign in' }).click()
      // signed in and inside the app, not stranded on the login screen
      await expect(page).toHaveURL('/')
      await expect(page.getByTestId('sign-out')).toBeVisible()
    })
  }

  test('shows an error for a bad password', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('dana@local.test')
    await page.getByLabel('Password').fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByTestId('login-error')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('signed in as a member', () => {
  test.use({ storageState: 'tests/e2e/.auth/rae.json' })

  test('reaches the app shell rather than the access-denied state', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('access-denied')).toBeHidden()
    // exact: true — the header logo link's accessible name is "Storage Boxes",
    // which substring-matches 'Boxes' too and makes the plain query ambiguous.
    await expect(page.getByRole('link', { name: 'Boxes', exact: true })).toBeVisible()
  })
})

test.describe('signed in without app membership', () => {
  test.use({ storageState: 'tests/e2e/.auth/nobody.json' })

  test('shows the access-denied state', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('access-denied')).toBeVisible()
  })
})

test.describe('signed in with a failing directory request', () => {
  test.use({ storageState: 'tests/e2e/.auth/dana.json' })

  test('reports the failure instead of claiming the account has no access', async ({ page }) => {
    await page.route('**/api/collections/storage_app_users/records**', route =>
      route.abort('failed')
    )
    await page.goto('/')
    // the directory query retries with backoff before settling into an error
    await expect(page.getByTestId('membership-error')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('access-denied')).toBeHidden()
  })
})
