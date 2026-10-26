import type { Locator, Page, TestInfo } from '@playwright/test'
import { chooseTimezone } from '~/tests/browser/publication/schedule-helpers'
import { assertAccessible } from '~/tests/support/browser/accessibility'
import { saved } from '~/tests/support/browser/document'
import { settingsTab } from '~/tests/support/browser/settings'
import { openWorkspace, serveWorkspace } from '../support/editor-workspace-case'
import { editorWorkspaceDocument } from '../support/editor-workspace-fixtures'
import { mountSurface } from '../support/mount'
import { expect, test } from '../support/test'

const palettes = [
  'Neutral',
  'Terracotta',
  'Moss',
  'Ocean',
  'Plum',
  'Graphite',
]
const chinesePalettes = [
  '中性',
  '暖陶',
  '苔绿',
  '海蓝',
  '莓紫',
  '石墨',
]

// The inspector is the editor's own settings surface: local form state (a
// timezone) has to survive tab switches, and switching the interface language
// must translate the controls without remounting the editor or its content.
test('inspector tabs preserve local settings and bilingual changes keep the native editor identity', async ({
  page,
}) => {
  const api = await serveWorkspace(page, editorWorkspaceDocument('Polished inspector'))
  try {
    await openWorkspace(page, { title: 'Polished inspector', width: 1440, height: 1000 })
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
    await page.getByRole('combobox', { name: 'Language', exact: true }).click()
    await page.getByRole('option', { name: '简体中文', exact: true }).click()
    await expect(body).toContainText('English content stays English')
    expect(await identity.evaluate(element => element.isConnected)).toBe(true)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

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

async function language(page: Page, name: 'English' | '简体中文'): Promise<void> {
  await page.getByRole('combobox', { name: /^(Language|语言)$/ }).click()
  await page.getByRole('option', { name, exact: true }).click()
}

// The save status and the draft badge are the same badge: one geometry, one dot
// and one padding, in both languages and at the narrowest width.
test('status badges share one geometry across locales and narrow layouts', async ({ page }, info) => {
  const api = await serveWorkspace(page, editorWorkspaceDocument('Status badge geometry'))
  try {
    await openWorkspace(page, { title: 'Status badge geometry', width: 1440, height: 1000 })
    const title = page.getByLabel('Title', { exact: true })
    // Editing a different title is what marks the draft dirty; re-entering the
    // stored title would leave the badge on its saved state.
    await title.fill('Consistent status presentation')
    const dirty = page.locator('.workspace-status .save-status')
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
    await title.fill('Narrow status comparison')
    await expect(dirty).toBeVisible()
    expect(await badgeGeometry(saveBadge)).toEqual(await badgeGeometry(draftBadge))
    await language(page, '简体中文')
    await page.getByLabel('标题', { exact: true }).fill('相同尺寸的状态标记')
    expect(await badgeGeometry(saveBadge)).toEqual(await badgeGeometry(draftBadge))
    expect((await badgeGeometry(saveBadge)).height).toBe(26)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath('admin-status-badges-zh-320.png') })
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

// One shared SaveStatus renders in the editor header and on the catalog page, so
// its dirty appearance has to be identical in both surfaces.
test('the unsaved-changes status keeps one appearance between the editor and the catalog page', async ({ page }) => {
  const api = await serveWorkspace(page, editorWorkspaceDocument('Status appearance parity'))
  try {
    const dirty = page.getByRole('status').filter({ hasText: /^Unsaved changes$/ })
    // The catalog surface mounts first: the editor is the last document, so the
    // run ends on the surface that owns the worker-backed block editor.
    await mountSurface(page, { surface: 'catalog-tag' })
    await expect(page.getByRole('heading', { name: 'Tags', exact: true })).toBeVisible()
    await page.getByLabel('Name', { exact: true }).fill('Unsaved catalog entry')
    await expect(dirty).toBeVisible()
    const catalogAppearance = await statusAppearance(dirty)
    await openWorkspace(page, { title: 'Status appearance parity', width: 1440, height: 1000 })
    await page.getByLabel('Title', { exact: true }).fill('A different status appearance')
    await expect(dirty).toBeVisible()
    expect(await statusAppearance(dirty)).toEqual(catalogAppearance)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

async function chooseAppearance(page: Page, chinese: boolean, name: string): Promise<void> {
  await page
    .getByRole('button', { name: chinese ? '外观' : 'Appearance', exact: true })
    .click()
  await page.getByRole('menuitemradio', { name, exact: true }).click()
  await expect(page.getByRole('menu')).toHaveCount(0)
}

async function scanModes(page: Page, info: TestInfo, chinese: boolean): Promise<void> {
  for (const mode of chinese
    ? [
        '浅色',
        '深色',
        '跟随系统',
      ]
    : [
        'Light',
        'Dark',
        'System',
      ]) {
    await chooseAppearance(page, chinese, mode)
    for (const palette of chinese ? chinesePalettes : palettes) {
      await chooseAppearance(page, chinese, palette)
      await assertAccessible(page, info, {
        label: `${chinese ? 'zh' : 'en'}-${mode}-${palette}`,
      })
    }
  }
}

test.describe('accessibility scanner', () => {
  test.use({ bypassCSP: true })

  // Appearance is presentation only. The editor keeps its identity and content
  // through every mode, palette and interface language, and the scan runs on the
  // real surface each time: 3 modes x 6 palettes x 2 languages.
  test('36 bilingual appearance states preserve the editor and have no axe violations', async ({ page }, info) => {
    // Keep the old E2E slow-case budget: 60 seconds × 3, not the
    // component configuration's shorter default or a relaxed five minutes.
    test.setTimeout(180_000)
    const api = await serveWorkspace(page, editorWorkspaceDocument('Appearance state'))
    try {
      await openWorkspace(page, { title: 'Appearance state', width: 1440, height: 1000 })
      const body = page.getByLabel('Document body', { exact: true })
      await body.fill('Appearance state native English 中文')
      await saved(page)
      const identity = await body.elementHandle()
      await scanModes(page, info, false)
      await page.getByRole('combobox', { name: 'Language', exact: true }).click()
      await page.getByRole('option', { name: '简体中文', exact: true }).click()
      await scanModes(page, info, true)
      expect(await identity.evaluate(element => element.isConnected)).toBe(true)
      await expect(body).toContainText('Appearance state native English 中文')
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })

  // The compact settings drawer is the editor's keyboard overlay: it has to open
  // from the trigger, keep its tabs readable, pass Axe and hand focus back.
  test('compact settings drawer keeps keyboard focus and axe on the editor at 320px', async ({ page }, info) => {
    const api = await serveWorkspace(page, editorWorkspaceDocument('Compact inspector'))
    try {
      await openWorkspace(page, { title: 'Compact inspector', width: 320, height: 740 })
      await page.getByLabel('Document body', { exact: true }).fill('A mobile writing workspace')
      await settingsTab(page, 'Content')
      await expect(page.getByRole('dialog', { name: 'Document settings', exact: true })).toBeVisible()
      const tabsFit = await page.getByRole('tab').evaluateAll(nodes =>
        nodes.every(node => node.scrollWidth <= node.clientWidth))
      expect(tabsFit).toBe(true)
      await assertAccessible(page, info, { label: 'inspector-drawer-320' })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.screenshot({ path: info.outputPath('admin-inspector-drawer-320.png'), fullPage: true })
      await page.getByRole('button', { name: 'Close', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Document settings', exact: true })).toBeFocused()
      await expect(page.getByLabel('Document body', { exact: true })).toContainText('A mobile writing workspace')
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
})
