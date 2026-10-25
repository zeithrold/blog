import { mountSurface } from '../support/mount'
import { expect, test } from '../support/test'

const googleFonts = /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//

type FontResponse = {
  url: string
  status: number
  resourceType: string
}

// The harness reuses the production stylesheet, whose Google Fonts imports are
// the only font source in the app layout. This smoke fails if that wiring turns
// into a silent fallback instead of loading the real Noto faces.
// Check native network/font state rather than treating build warnings as proof.
test('the harness loads real Noto fonts through the production stylesheet', async ({ page }) => {
  const responses: FontResponse[] = []
  page.on('response', (response) => {
    if (googleFonts.test(response.url())) {
      responses.push({
        url: response.url(),
        status: response.status(),
        resourceType: response.request().resourceType(),
      })
    }
  })
  await page.route(/\/api\/admin\/documents(?:\?|$)/, async (route) => {
    await route.fulfill({ status: 200, json: { items: [], nextCursor: null } })
  })

  await mountSurface(page, { surface: 'documents', locale: 'zh' })
  await expect.poll(
    () => responses.filter(response => response.status === 200
      && response.resourceType === 'font').length,
    { timeout: 20000 },
  ).toBeGreaterThan(0)
  await page.evaluate(async () => {
    await document.fonts.ready
  })

  const loaded = await page.evaluate(() => {
    const heading = document.querySelector('h1')
    const faces = Array.from(document.fonts)
    return {
      families: faces.filter(face => face.status === 'loaded').map(face => face.family),
      headingFontFamily: heading === null ? '' : getComputedStyle(heading).fontFamily,
    }
  })
  expect(responses.some(response => response.status === 200
    && response.resourceType === 'stylesheet'
    && response.url.startsWith('https://fonts.googleapis.com/'))).toBe(true)
  expect(loaded.families).toContain('Noto Sans')
  expect(loaded.families).toContain('Noto Sans SC')
  expect(loaded.headingFontFamily).toContain('Noto Sans')
  expect(loaded.headingFontFamily).toContain('Noto Sans SC')
})
