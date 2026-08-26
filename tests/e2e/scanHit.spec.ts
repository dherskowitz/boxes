import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import QRCode from 'qrcode'
import { authedPb, createBox, createItem, throwawayBoxes } from './helpers'

test.use({ storageState: 'tests/e2e/.auth/dana.json' })

const throwaway = throwawayBoxes()

// The live camera cannot be driven from a test, but everything after a read
// can: "From photo" runs the scanned text through the same `qrIdFromScan` and
// lands on the same confirmation. That is the part with behaviour worth
// pinning.
//
// The code is generated here rather than screenshotted out of the print page,
// so the test exercises a real decodable QR and does not depend on how the
// label happens to render one.
async function qrPng(base: string, qrId: string): Promise<Buffer> {
  // The payload a printed label carries: the absolute box URL, which is what
  // `boxQrUrl` commits to paper. Built from the project's own baseURL rather
  // than a hardcoded port — `qrIdFromScan` reads only the pathname, so a wrong
  // origin would still pass and quietly stop testing what the label carries.
  return QRCode.toBuffer(`${base}/box/${qrId}`, { type: 'png', width: 512, margin: 2 })
}

async function scanFromPhoto(page: Page, base: string, qrId: string) {
  await page.goto('/scan')
  await page.getByTestId('scan-from-photo').setInputFiles({
    name: 'label.png',
    mimeType: 'image/png',
    buffer: await qrPng(base, qrId)
  })
}

test('confirms which box was scanned, then opens it', async ({ page, baseURL }) => {
  const pb = await authedPb()
  const box = await createBox(pb, { title: 'Camping gear and tent poles', location: 'Garage shelf B2' })
  throwaway.push(box.id)
  await createItem(pb, { boxId: box.id, title: 'Two-burner camp stove' })

  await scanFromPhoto(page, baseURL ?? '', box.qr_id)

  // Named before the page changes — the whole point of the beat.
  await expect(page.getByTestId('scan-hit')).toBeVisible()
  await expect(page.getByTestId('scan-hit-title')).toHaveText('Camping gear and tent poles')
  await expect(page.getByTestId('scan-hit-code')).toHaveText(`BOX-${box.qr_id.toUpperCase()}`)
  await expect(page.getByTestId('scan-hit-chip')).toContainText('Garage shelf B2')

  // ...and then gets out of the way on its own.
  await expect(page).toHaveURL(`/box/${box.qr_id}`)
})

test('scan again returns to the camera instead of opening the box', async ({ page, baseURL }) => {
  const pb = await authedPb()
  const box = await createBox(pb, { title: 'Wrong box entirely' })
  throwaway.push(box.id)

  await scanFromPhoto(page, baseURL ?? '', box.qr_id)

  await expect(page.getByTestId('scan-hit')).toBeVisible()
  await page.getByTestId('scan-again').click()

  // The pending navigation is cancelled, not merely hidden behind the camera.
  await expect(page.getByTestId('qr-scanner')).toBeVisible()
  await expect(page).toHaveURL('/scan')
  await page.waitForTimeout(1500)
  await expect(page).toHaveURL('/scan')
})
