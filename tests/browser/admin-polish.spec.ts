import { expect, test } from '@playwright/test'
import { captureState } from '@ztd-me/frontend-checks/playwright'
import { assertAccessible } from './accessibility'
import { chooseTimezone, saved, settingsTab } from './helpers'

test('inspector tabs preserve local settings and bilingual changes keep the native editor identity', async ({
  page,
}, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/__fixture/login')
  await page.getByRole('button', { name: 'New post', exact: true }).click()
  const body = page.getByLabel('Document body', { exact: true })
  const identity = await body.elementHandle()
  await page.getByLabel('Title', { exact: true }).fill('Polished inspector')
  await page.getByLabel('Slug', { exact: true }).fill('polished-inspector')
  await body.fill('English content stays English while the interface changes language.')
  await saved(page)
  await settingsTab(page, 'Publication')
  await page.getByText('Scheduled publication', { exact: true }).click()
  await chooseTimezone(page, 'Asia/Tokyo')
  await settingsTab(page, 'Content')
  await settingsTab(page, 'Publication')
  await expect(page.getByRole('combobox', { name: 'Publication timezone', exact: true })).toContainText('Asia/Tokyo')
  await page.getByRole('combobox', { name: 'Language', exact: true }).click()
  await page.getByRole('option', { name: '简体中文', exact: true }).click()
  await expect(page.getByRole('tab', { name: '发布', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '保存', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '发布', exact: true })).toBeVisible()
  await expect(page.getByRole('combobox', { name: '发布时区', exact: true })).toContainText('Asia/Tokyo')
  await expect(body).toContainText('English content stays English')
  expect(await identity.evaluate(element => element.isConnected)).toBe(true)
  expect(errors).toEqual([])
  await captureState(page, info, 'inspector-zh-publication')
  await page.screenshot({ path: info.outputPath('inspector-zh-desktop.png'), fullPage: true })
})

test.describe('accessibility scanner', () => {
  test.use({ bypassCSP: true })
  test('compact navigation, filters and inspector use keyboard accessible overlays at 320px', async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 320, height: 740 })
    await page.goto('/__fixture/login')
    await page.getByRole('button', { name: 'Documents', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Operations', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Operations', exact: true })).toBeVisible()
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Operations', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Documents', exact: true }).click()
    const state = page.getByRole('combobox', { name: 'Publication state', exact: true })
    await state.click()
    await page.getByRole('option', { name: 'Draft', exact: true }).click()
    await state.click()
    await page.keyboard.press('Escape')
    await expect(state).toBeFocused()
    await page.getByRole('button', { name: 'New post', exact: true }).click()
    await page.getByLabel('Title', { exact: true }).fill('Compact inspector')
    await page.getByLabel('Document body', { exact: true }).fill('A mobile writing workspace')
    await settingsTab(page, 'Content')
    await expect(page.getByRole('dialog', { name: 'Document settings', exact: true })).toBeVisible()
    const tabsFit = await page.getByRole('tab').evaluateAll(nodes =>
      nodes.every(node => node.scrollWidth <= node.clientWidth))
    expect(tabsFit).toBe(true)
    await assertAccessible(page, info, { label: 'inspector-drawer-320' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath('inspector-drawer-320.png'), fullPage: true })
    await page.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Document settings', exact: true })).toBeFocused()
    await expect(page.getByLabel('Document body', { exact: true })).toContainText('A mobile writing workspace')
  })
})
