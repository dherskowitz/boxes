import { expect, test } from '@playwright/test'

test.use({ storageState: 'tests/e2e/.auth/dana.json' })

/** The screens between them use most of the app's icon set. */
const SCREENS = ['/', '/boxes', '/items', '/tags', '/more', '/scan', '/box/seedbox1']

/**
 * Every glyph is compiled into the client bundle at build time.
 *
 * Nuxt Icon's default behaviour is to bundle whatever its scan finds and fetch
 * the rest from `api.iconify.design` on demand. That renders nothing at all on
 * a phone with no signal — the case this app exists for — and tells a third
 * party which screens get opened. Both halves are asserted: no request leaves
 * for an icon, and the icons are actually painted rather than silently empty.
 */
test('renders every icon without asking the network for one', async ({ page }) => {
  const remote: string[] = []
  page.on('request', (request) => {
    const url = request.url()
    if (url.includes('iconify.design') || url.includes('_nuxt_icon')) remote.push(url)
  })

  for (const path of SCREENS) {
    await page.goto(path)
    // Something icon-bearing has to be on screen before the assertion means
    // anything. Detail screens hide the nav pill, so wait on an icon itself
    // rather than on any one piece of chrome.
    await expect(page.locator('.iconify').first()).toBeAttached()

    // Nuxt Icon paints a monotone glyph as a `mask-image` holding an inline
    // data: URI. A remote or missing one shows up as `none` or an http URL,
    // which is exactly the failure this guards.
    const unpainted = await page.evaluate(() => {
      const bad: string[] = []
      for (const el of document.querySelectorAll('.iconify')) {
        const style = getComputedStyle(el)
        const paint = style.getPropertyValue('mask-image') || style.backgroundImage
        if (!paint.includes('data:image/svg+xml')) {
          bad.push(`${el.className.toString().slice(0, 60)} -> ${paint.slice(0, 40)}`)
        }
      }
      return bad
    })
    expect(unpainted, `unpainted icons on ${path}`).toEqual([])
  }

  expect(remote, 'icons were fetched from the network').toEqual([])
})
