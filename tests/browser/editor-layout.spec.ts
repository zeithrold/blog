import { expect, test } from '@playwright/test'
import { chooseTimezone, publicationTime, saved, settingsTab, verifiedTime } from './helpers'

type ChromeGeometry = { toolbarGap: number, headerGap: number, overflow: boolean }

test('schedule input and verified times survive closing the compact inspector and resizing', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/__fixture/login')
  await page.getByRole('button', { name: 'New post', exact: true }).click()
  await expect(page.getByLabel('Document body', { exact: true })).toBeVisible()
  await settingsTab(page, 'Publication')
  await page.getByText('Scheduled publication', { exact: true }).click()
  await publicationTime(page, '2099-05-01T10:30')
  await chooseTimezone(page, 'Asia/Tokyo')
  await page.getByRole('button', { name: 'Check timezone and DST', exact: true }).click()
  const time = page.getByRole('combobox', { name: 'Verified UTC time', exact: true })
  const verified = await verifiedTime(page)
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Document settings', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Document settings', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Publication', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('combobox', { name: 'Publication timezone', exact: true })).toContainText('Asia/Tokyo')
  await expect(page.getByRole('button', { name: 'Publication date', exact: true })).toContainText('May 1, 2099')
  await expect(page.getByLabel('Publication time', { exact: true })).toHaveValue('10:30')
  await expect(time).toHaveText(verified)
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await expect(page.getByRole('tab', { name: 'Publication', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(time).toHaveText(verified)
  await expect(page.getByRole('combobox', { name: 'Publication timezone', exact: true })).toContainText('Asia/Tokyo')
  await page.setViewportSize({ width: 320, height: 740 })
  await page.getByRole('button', { name: 'Document settings', exact: true }).click()
  await expect(time).toHaveText(verified)
})

test('wrapped status keeps the sticky toolbar below the measured header at 320px', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text())
    }
  })
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/__fixture/login')
  await page.getByRole('button', { name: 'New post', exact: true }).click()
  await page.getByLabel('Title', { exact: true }).fill('A narrow writing workspace')
  await settingsTab(page, 'Content')
  await page.getByLabel('Slug', { exact: true }).fill(`narrow-writing-${crypto.randomUUID()}`)
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Document settings', exact: true })).toHaveCount(0)
  const body = page.getByLabel('Document body', { exact: true })
  await body.fill('Published content')
  await saved(page)
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByText('Published', { exact: true })).toBeVisible()
  await body.fill('A long draft paragraph for scrolling. '.repeat(120))
  await saved(page)
  await expect(page.getByText('Published · unpublished changes', { exact: true })).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 650))
  const geometry = async (): Promise<ChromeGeometry> => await page.evaluate(() => {
    const appbar = document.querySelector('.ztd-application > .ztd-appbar')?.getBoundingClientRect()
    const header = document.querySelector('.workspace-header')?.getBoundingClientRect()
    const toolbar = document.querySelector('.editor-actions')?.getBoundingClientRect()
    if (appbar === undefined || header === undefined || toolbar === undefined) {
      throw new Error('The editor chrome is missing')
    }
    return {
      toolbarGap: toolbar.top - header.bottom,
      headerGap: header.top - appbar.bottom,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    }
  })
  await expect.poll(async () => (await geometry()).toolbarGap).toBeGreaterThanOrEqual(-1)
  await expect.poll(async () => Math.abs((await geometry()).headerGap)).toBeLessThanOrEqual(1)
  expect((await geometry()).overflow).toBe(false)
  const headerHeight = async (): Promise<number> => await page.locator('.workspace-header')
    .evaluate(element => element.getBoundingClientRect().height)
  const narrowHeight = await headerHeight()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await expect.poll(headerHeight).toBeLessThan(narrowHeight)
  await page.setViewportSize({ width: 320, height: 740 })
  expect(errors).toEqual([])
  await page.screenshot({ path: info.outputPath('editor-sticky-320.png') })
})
