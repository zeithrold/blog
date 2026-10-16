import type { Locator, Page } from '@playwright/test'
import { emptyDocument } from '@/content/document'
import { saved, writeDocument } from '~/tests/support/browser/document'
import { expect, test } from '~/tests/support/browser/test'

async function language(page: Page, name: 'English' | '简体中文'): Promise<void> {
  await page.getByRole('combobox', { name: /^(Language|语言)$/ }).click()
  await page.getByRole('option', { name, exact: true }).click()
}

async function statusAppearance(status: Locator): Promise<Record<string, string | number>> {
  return await status.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      background: style.backgroundColor,
      foreground: style.color,
      radius: style.borderRadius,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      paddingTop: Number.parseFloat(style.paddingTop),
      paddingBottom: Number.parseFloat(style.paddingBottom),
      paddingLeft: Number.parseFloat(style.paddingLeft),
      paddingRight: Number.parseFloat(style.paddingRight),
    }
  })
}

async function badgeGeometry(badge: Locator): Promise<Record<string, string | number>> {
  return await badge.evaluate((element) => {
    const style = getComputedStyle(element)
    const dotElement = element.querySelector('[aria-hidden="true"]')
    if (dotElement === null) {
      throw new Error('Missing status dot')
    }
    const dot = getComputedStyle(dotElement)
    return {
      height: element.getBoundingClientRect().height,
      padding: style.padding,
      borderWidth: style.borderWidth,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      radius: style.borderRadius,
      gap: style.gap,
      dotWidth: dot.width,
      dotHeight: dot.height,
      dotFlex: dot.flex,
    }
  })
}

test('publication actions describe the live state while draft synchronization stays in the menu', async ({
  page,
}, info) => {
  const document = emptyDocument()
  document.meta.title = 'Publication action labels'
  document.meta.slug = `publication-action-${crypto.randomUUID()}`
  await writeDocument(page, document)
  const publish = page.getByRole('button', { name: 'Publish', exact: true })
  await expect(publish).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Publish draft', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'More document actions', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Sync draft now', exact: true })).toBeDisabled()
  await page.keyboard.press('Escape')
  await language(page, '简体中文')
  const chinesePublish = page.getByRole('button', { name: '发布', exact: true })
  await expect(chinesePublish).toBeVisible()
  await expect(page.getByRole('button', { name: '保存', exact: true })).toHaveCount(0)
  await chinesePublish.click()
  const update = page.getByRole('button', { name: '更新发布', exact: true })
  await expect(update).toBeVisible()
  await expect(page.getByRole('button', { name: '发布', exact: true })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('editor-actions-zh.png') })
  await language(page, 'English')
  await expect(page.getByRole('button', { name: 'Update publication', exact: true })).toBeVisible()
})

test('status badges share geometry across locales and narrow layouts', async ({ page }, info) => {
  await page.goto('/__fixture/login')
  await page.getByRole('button', { name: 'New post', exact: true }).click()
  await page.getByLabel('Title', { exact: true }).fill('Consistent status presentation')
  const dirty = page.getByRole('status').filter({ hasText: /^Unsaved changes$/ })
  await expect(dirty).toBeVisible()
  const saveBadge = page.locator('.workspace-status .save-status')
  const draftBadge = page.locator('.workspace-status [data-slot="badge"][data-state="draft"]')
  expect(await badgeGeometry(saveBadge)).toEqual(await badgeGeometry(draftBadge))
  const geometry = await badgeGeometry(saveBadge)
  expect(geometry.height).toBe(26)
  expect(geometry.dotWidth).toBe('6px')
  expect(geometry.dotHeight).toBe('6px')
  const editorAppearance = await statusAppearance(dirty)
  expect(editorAppearance.paddingTop).toBeGreaterThan(0)
  expect(editorAppearance.paddingBottom).toBeGreaterThan(0)
  expect(editorAppearance.paddingLeft).toBeGreaterThan(0)
  await saved(page)
  await page.setViewportSize({ width: 320, height: 740 })
  await page.getByLabel('Title', { exact: true }).fill('Narrow status comparison')
  await expect(dirty).toBeVisible()
  expect(await badgeGeometry(saveBadge)).toEqual(await badgeGeometry(draftBadge))
  await language(page, '简体中文')
  await expect(page.getByRole('option')).toHaveCount(0)
  await page.getByLabel('标题', { exact: true }).fill('相同尺寸的状态标记')
  await expect(page.getByText('未保存修改', { exact: true })).toBeVisible()
  expect(await badgeGeometry(saveBadge)).toEqual(await badgeGeometry(draftBadge))
  expect((await badgeGeometry(saveBadge)).height).toBe(26)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('consistent-status-badges-zh-320.png') })
  await expect(page.getByRole('status').filter({ hasText: /^已保存$/ })).toBeVisible({ timeout: 15000 })
  await language(page, 'English')
  await expect(page.getByRole('option')).toHaveCount(0)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/admin/tags')
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled()
  await page.getByLabel('Name', { exact: true }).fill('Unsaved catalog entry')
  await expect(dirty).toBeVisible()
  expect(await statusAppearance(dirty)).toEqual(editorAppearance)
})

test('clicking the document body outside its desktop actions menu preserves the writing focus', async ({ page }) => {
  const document = emptyDocument()
  document.meta.title = 'Document menu focus'
  document.meta.slug = `document-menu-focus-${crypto.randomUUID()}`
  await writeDocument(page, document)
  const body = page.getByLabel('Document body', { exact: true })
  await page.getByRole('button', { name: 'More document actions', exact: true }).click()
  await expect(page.getByRole('menu')).toBeVisible()
  await body.click()
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(body).toBeFocused()
  await body.pressSequentially('Continue writing after dismissing the actions menu')
  await saved(page)
  await expect(body).toContainText('Continue writing after dismissing the actions menu')
})

test('compact administration navigation leaves vertical space around its trigger', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/__fixture/login')
  await page.goto('/admin/operations')
  for (const width of [
    320,
    390,
    768,
  ]) {
    await page.setViewportSize({ width, height: 844 })
    const navigation = page.getByRole('navigation', { name: 'Admin navigation', exact: true })
    const trigger = navigation.getByRole('button', { name: 'Operations', exact: true })
    await expect(trigger).toBeVisible()
    const insets = await trigger.evaluate((element) => {
      const container = element.closest('nav')?.getBoundingClientRect()
      const button = element.getBoundingClientRect()
      if (container === undefined) {
        throw new Error('Administration navigation is missing')
      }
      return { top: button.top - container.top, bottom: container.bottom - button.bottom }
    })
    expect(insets.top).toBeGreaterThanOrEqual(7)
    expect(insets.bottom).toBeGreaterThanOrEqual(7)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('navigation', { name: 'Admin navigation', exact: true })
    .getByRole('button', { name: 'Operations', exact: true })
    .click()
  await expect(page.getByRole('menuitem', { name: 'Documents', exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('mobile-navigation-spacing.png') })
})
