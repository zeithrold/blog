import { saved } from '~/tests/support/browser/document'
import { settingsTab } from '~/tests/support/browser/settings'
import { expect, test } from '~/tests/support/browser/test'

test('the editor loader displays a skeleton and spinner and respects reduced motion', async ({
  page,
  browserName,
}, info) => {
  await page.goto('/__fixture/login')
  let release: () => void = () => {}
  const responseGate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(/\/_next\/static\/chunks\/editor-[^/]+\.js(?:\?.*)?$/, async (route) => {
    await responseGate
    await route.continue()
  })
  await page.getByRole('button', { name: 'New post', exact: true }).click({ noWaitAfter: true })
  const loader = page.locator('.editor-loading')
  try {
    await expect(loader).toBeVisible()
    await expect(loader.getByRole('status')).toHaveText('Loading editor…')
    await expect(loader.locator('.editor-loading-skeleton').first()).toBeVisible()
    const spinner = loader.locator('.editor-loading-spinner')
    await expect(spinner).toHaveCSS('animation-name', 'spin')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(spinner).toHaveCSS('animation-name', 'none')
    await expect(loader.locator('.editor-loading-skeleton').first()).toHaveCSS('animation-name', 'none')
    // WebKit waits for document.fonts.ready while the intentionally held script keeps the page loading.
    if (browserName === 'chromium') {
      await page.screenshot({ path: info.outputPath('editor-loading-skeleton.png'), fullPage: true })
    }
  }
  finally {
    release()
  }
  await expect(page.getByLabel('Document body', { exact: true })).toBeVisible()
  await expect(loader).toHaveCount(0)
})

test('the compact inspector opens from the bottom and keeps its footer reachable while scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/__fixture/login')
  await page.getByRole('button', { name: 'New post', exact: true }).click()
  const body = page.getByLabel('Document body', { exact: true })
  await expect(body).toBeVisible()
  const identity = await body.elementHandle()
  await page.getByLabel('Title', { exact: true }).fill('Drawer writing workspace')
  await body.fill('Keep this native editor mounted while the inspector changes.')
  await saved(page)
  await settingsTab(page, 'Content')
  const drawer = page.getByRole('dialog', { name: 'Document settings', exact: true })
  await expect(drawer).toHaveClass(/inspector-drawer/)
  await expect(drawer.locator('[data-slot="drawer-handle"]')).toBeVisible()
  await expect.poll(async () => await drawer.evaluate((element) => {
    const box = element.getBoundingClientRect()
    return Math.abs(box.bottom - window.innerHeight)
  })).toBeLessThanOrEqual(2)
  expect(await drawer.evaluate(element => element.getBoundingClientRect().height <= window.innerHeight * 0.9 + 2))
    .toBe(true)
  await drawer.getByRole('button', { name: /^References \(/ }).click()
  await drawer.getByRole('button', { name: 'Add reference', exact: true }).click()
  const reference = page.getByRole('dialog', { name: 'Add reference', exact: true })
  await reference.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(reference).toHaveCount(0)
  const scroll = drawer.getByRole('region', { name: 'Document settings', exact: true })
  expect(await scroll.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true)
  await scroll.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  const close = drawer.getByRole('button', { name: 'Close', exact: true })
  await expect(close).toBeInViewport()
  await close.click()
  await expect(page.getByRole('button', { name: 'Document settings', exact: true })).toBeFocused()
  await expect(body).toContainText('Keep this native editor mounted')
  expect(await identity.evaluate(element => element.isConnected)).toBe(true)
  await page.getByRole('button', { name: 'Document settings', exact: true }).click()
  await expect(drawer.getByRole('tab', { name: 'Content', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await expect(page.locator('.document-settings')).toBeVisible()
  await expect(drawer).toHaveCount(0)
  expect(await identity.evaluate(element => element.isConnected)).toBe(true)
})
