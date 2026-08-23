import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { LABEL_SIZES } from '../../app/utils/labelSizes'

test.use({ storageState: 'tests/e2e/.auth/dana.json' })

/** Horizontal overflow of the whole document, in px. */
function overflow(page: Page): Promise<number> {
  return page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth)
}

async function pickSize(page: Page, name: string | RegExp): Promise<void> {
  await page.getByTestId('label-size').click()
  await page.getByRole('option', { name }).click()
}

// Four of the five stocks are 4in wide — wider than the 412px phone this app is
// built for. The preview has to shrink them, not push the whole page sideways.
test('every label size fits the single preview without scrolling the page', async ({ page }) => {
  await page.goto('/box/seedbox1/print')
  await expect(page.getByTestId('print-size-label')).toBeVisible()

  for (const size of LABEL_SIZES) {
    await pickSize(page, size.name)
    await expect(page.getByTestId('print-size-label')).toContainText(size.name)
    expect(await overflow(page), `single preview at ${size.name}`).toBe(0)

    // The label must fit inside its own frame, not merely fail to scroll the
    // document: the frame clips, so a label that is too wide is silently cut
    // off rather than pushing the page sideways. Measuring the document alone
    // passes even with the scaling disabled — checked by disabling it.
    const label = await page.getByTestId('box-label').boundingBox()
    const frame = await page.getByTestId('label-frame').boundingBox()
    expect(label, `label box at ${size.name}`).not.toBeNull()
    expect(frame, `label frame at ${size.name}`).not.toBeNull()
    expect(label?.width ?? 0, `label fits its frame at ${size.name}`)
      .toBeLessThanOrEqual((frame?.width ?? 0) + 1)

    // Shrunk, not squashed. Clamping the width while the height stayed in
    // inches would also stop the overflow — and render a 4 × 4 label as a
    // rectangle, which is the one thing a preview of physical stock must not
    // do. The rendered box has to keep the stock's ratio.
    const rendered = (label?.width ?? 0) / (label?.height ?? 1)
    expect(rendered, `aspect ratio at ${size.name}`).toBeCloseTo(size.width / size.height, 1)
  }

  // The choice is remembered, so put it back for the rest of the run.
  await pickSize(page, '4 × 4 in')
})

test('every label size fits the sheet preview too', async ({ page }) => {
  await page.goto('/print-sheet')
  await page.getByRole('button', { name: 'Select all' }).click()
  await expect(page.getByTestId('print-label-seedbox1')).toBeVisible()

  for (const size of LABEL_SIZES) {
    // The sheet picker appends "· N per sheet", so match the leading name.
    await pickSize(page, new RegExp(`^${size.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
    await expect(page.getByTestId('sheet-summary')).toContainText(size.name)
    expect(await overflow(page), `sheet preview at ${size.name}`).toBe(0)

    // Same frame check as above, and for the same reason — the frame clips, so
    // the document-level check alone passes even with the scaling removed.
    const label = await page.getByTestId('print-label-seedbox1').boundingBox()
    const frame = await page.getByTestId('label-frame').boundingBox()
    expect(label?.width ?? 0, `sheet label fits its frame at ${size.name}`)
      .toBeLessThanOrEqual((frame?.width ?? 0) + 1)
  }

  await pickSize(page, '2 × 2 in')
})
