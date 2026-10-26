import type { Page, TestInfo } from '@playwright/test'
import type { Presentation } from '~/tests/support/browser/journey-layout'
import { emptyDocument } from '@/content/document'
import { editor as en } from '@/i18n/resources/en/editor'
import { site as enSite } from '@/i18n/resources/en/site'
import { editor as zh } from '@/i18n/resources/zh-CN/editor'
import { site as zhSite } from '@/i18n/resources/zh-CN/site'
import { assertAccessible } from '~/tests/support/browser/accessibility'
import { auditControls } from '~/tests/support/browser/control-audit'
import { writeDocument } from '~/tests/support/browser/document'
import {
  assertPageLayout,
  assertTypography,
  assertUsable,
  capturePresentation,
  expectPresentation,
  expectReleased,
  settle,
} from '~/tests/support/browser/journey-layout'
import { withinViewport } from '~/tests/support/browser/layout'
import { expect, test } from '~/tests/support/browser/test'
import { inline, textBlock } from './content-fixture'

async function audit(page: Page, info: TestInfo, name: string): Promise<void> {
  await settle(page)
  const locale = info.titlePath.some(title => title.endsWith(' zh')) ? 'zh-CN' : 'en'
  const dark = (info.project.name === 'webkit') === (locale === 'en')
  await expect(page.locator('html')).toHaveAttribute('lang', locale)
  await expect(page.locator('html')).toHaveAttribute('data-frontend-mode', dark ? 'dark' : 'light')
  await expect(page.locator('.ztd-frontend').first()).toHaveCSS('color-scheme', dark ? 'dark' : 'light')
  await assertPageLayout(page)
  await auditControls(page, info, name)
  await assertAccessible(page, info, { label: name })
}

async function section(page: Page, href: string): Promise<void> {
  const link = page.locator(`a[href="${href}"]:visible`).first()
  if (await link.isVisible()) {
    await link.click()
  }
  else {
    await page.locator('.workspace-navigation-mobile').click()
    await page.locator(`a[href="${href}"][role="menuitem"]`).click()
  }
  await expect(page).toHaveURL(new RegExp(`${href}$`))
}

// Two variants per browser at each width give 12 rows and cover every pair of
// browser, locale, theme and width. No skipped projects or Cartesian explosion.
// The width and locale are part of the registered title: one journey run six
// times is six cases, and the ledger has to name the variant it retains.
function accessibilityTitle(width: number, locale: string): string {
  const subject = 'accessibility scanner: late controls retain layout, focus and interaction contracts'
  return `${subject} at ${width}px in ${locale}`
}

for (const width of [
  320,
  390,
  1440,
]) {
  for (const locale of ['en', 'zh'] as const) {
    test.describe(`presentation journey ${width}px ${locale}`, () => {
      test.use({ bypassCSP: true, viewport: { width, height: 900 }, reducedMotion: 'reduce' })
      test(accessibilityTitle(width, locale), runPresentation)
    })
  }
}

type PresentationInput = { page: Page, browserName: string }

async function keyboardModifier({ page, browserName }: PresentationInput): Promise<string> {
  // macOS WebKit follows the host's Keyboard Navigation preference. Option+Tab
  // includes buttons regardless of that preference; keep the same exact focus assertions.
  return browserName === 'webkit' && await page.evaluate(() => navigator.platform.startsWith('Mac')) ? 'Alt+' : ''
}

async function runPresentation({ page, browserName }: PresentationInput, info: TestInfo): Promise<void> {
  test.setTimeout(120000)
  const state = await preparePresentation({ page, browserName }, info)
  await test.step(
    'capture initial actions and preview',
    async () => await initialControls(state),
  )
  await test.step(
    'visit every admin section and return to the same saved draft',
    async () => await adminRoundTrip(state),
  )
  await test.step(
    'publish, read, search and return through public navigation',
    async () => await publicRoundTrip(state),
  )
}

async function preparePresentation({ page, browserName }: PresentationInput, info: TestInfo) {
  const width = page.viewportSize()?.width ?? 1440
  const locale = info.titlePath.some(title => title.endsWith(' zh')) ? 'zh' : 'en'

  const copy = locale === 'en' ? en : zh
  const site = locale === 'en' ? enSite : zhSite
  const dark = (browserName === 'webkit') === (locale === 'en')
  const theme = dark ? 'dark' : 'light'
  const prefix = `${width}-${locale}-${theme}`
  const tabModifier = await keyboardModifier({ page, browserName })
  await info.attach('environment.json', {
    body: JSON.stringify({
      browserName,
      width,
      locale,
      theme,
      keyboardTraversal: `${tabModifier}Tab`,
      userAgent: await page.evaluate(() => navigator.userAgent),
    }, null, 2),
    contentType: 'application/json',
  })
  const document = emptyDocument()
  document.meta.title = 'Visual journey article'
  document.meta.slug = 'visual-journey'
  const first = document.blocks[0]
  if (first !== undefined) {
    first.content = inline('Visual journey content 中文。 A stable paragraph after a complete task.')
  }
  document.blocks.push(textBlock('callout', 'Visual journey notice', { tone: 'info' }))
  await writeDocument(page, document)
  await page.getByRole('button', { name: 'Appearance', exact: true }).click()
  await page.getByRole('menuitemradio', { name: dark ? 'Dark' : 'Light', exact: true }).click()
  if (locale === 'zh') {
    await page.getByRole('combobox', { name: 'Language', exact: true }).click()
    await page.getByRole('option', { name: '简体中文', exact: true }).click()
    await page.reload()
  }
  const body = page.getByLabel(copy.documentBody, { exact: true })
  await expect(body).toBeVisible()
  const actions = page.getByRole('button', { name: copy.moreDocumentActions, exact: true })
  await assertTypography(body)
  await assertUsable(actions, 44)

  const initial = new Map<string, Presentation>()
  return { page, info, width, locale, copy, site, prefix, body, actions, tabModifier, initial }
}

type PresentationState = Awaited<ReturnType<typeof preparePresentation>>

async function initialControls(state: PresentationState): Promise<void> {
  const { page, info, width, copy, prefix, actions, initial, tabModifier } = state

  await actions.click()
  const panel = page.locator('.document-action-menu[role="menu"], .document-actions-drawer[role="dialog"]')
  await withinViewport(page, panel)
  await assertUsable(panel.getByRole(width <= 700 ? 'button' : 'menuitem', {
    name: copy.preview,
    exact: true,
  }), 44)
  initial.set('actions', await capturePresentation(panel, info, `${prefix}-initial-actions`))
  await audit(page, info, 'initial-actions')
  await page.keyboard.press('Escape')
  await expectReleased(page, actions)
  await actions.click()
  await panel.getByRole(width <= 700 ? 'button' : 'menuitem', { name: copy.preview, exact: true }).click()
  const preview = page.getByRole('dialog', { name: copy.draftPreview, exact: true })
  await expect(preview).toContainText('Visual journey content')
  await withinViewport(page, preview)
  const close = preview.getByRole('button', { name: copy.closePreview, exact: true })
  await assertUsable(close, 44)
  await expect(close).toBeFocused()
  await page.keyboard.press(`${tabModifier}Tab`)
  await expect(preview.locator('.draft-preview-reader')).toBeFocused()
  await page.keyboard.press(`${tabModifier}Shift+Tab`)
  await expect(close).toBeFocused()
  await assertTypography(preview.locator('.reader-body'))
  initial.set('preview', await capturePresentation(preview, info, `${prefix}-initial-preview`))
  await audit(page, info, 'initial-preview')
  await preview.getByRole('button', { name: copy.closePreview, exact: true }).click()
  await expectReleased(page, actions)
}

async function adminRoundTrip(state: PresentationState): Promise<void> {
  const { page, info, width, copy, prefix, body, actions, initial } = state

  for (const route of [
    'tags',
    'series',
    'media',
    'operations',
    'documents',
  ]) {
    await section(page, `/admin/${route}`)
    await expect(page.locator('main h1')).toBeVisible()
    const apis: Record<string, string> = { tags: 'catalog/tag', series: 'catalog/series', media: 'assets' }
    const api = apis[route] ?? route
    await expect.poll(async () => (await page.request.get(`/api/admin/${api}`)).status()).toBe(200)
    await expect(page.locator('main [role="status"]').filter({ hasText: /Loading|加载/ })).toHaveCount(0)
    await audit(page, info, route)
    if (route === 'tags') {
      await capturePresentation(page.locator('.admin-form'), info, `${prefix}-catalog`)
    }
  }
  await page.getByRole('link', { name: 'Visual journey article' }).click()
  await expect(body).toContainText('Visual journey content')
  await actions.click()
  const panel = page.locator('.document-action-menu[role="menu"], .document-actions-drawer[role="dialog"]')
  const laterActions = await capturePresentation(panel, info, `${prefix}-late-actions`)
  expectPresentation(laterActions, initial.get('actions'))
  await page.keyboard.press('Escape')
  await expectReleased(page, actions)
  await actions.click()
  await panel.getByRole(width <= 700 ? 'button' : 'menuitem', { name: copy.preview, exact: true }).click()
  const preview = page.getByRole('dialog', { name: copy.draftPreview, exact: true })
  await expect(preview).toContainText('Visual journey content')
  await audit(page, info, 'late-preview')
  const laterPreview = await capturePresentation(preview, info, `${prefix}-late-preview`)
  expectPresentation(laterPreview, initial.get('preview'))
  await preview.getByRole('button', { name: copy.closePreview, exact: true }).click()
  await expectReleased(page, actions)
  await actions.click()
  await panel.getByRole(width <= 700 ? 'link' : 'menuitem', {
    name: copy.viewAndCompareRevisions,
    exact: true,
  }).click()
  await expect(page.locator('.history-selection')).toBeVisible()
  await audit(page, info, 'history')
  await capturePresentation(page.locator('.history-selection'), info, `${prefix}-history`)
  await page.getByRole('link', { name: copy.backToEditor, exact: true }).click()
  await expect(body).toContainText('Visual journey content')
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

async function publicRoundTrip(state: PresentationState): Promise<void> {
  const { page, info, copy, site, prefix, initial } = state

  await page.getByRole('button', { name: copy.publishDraft, exact: true }).click()
  await expect(page.getByRole('button', { name: copy.updatePublication, exact: true })).toBeVisible()
  await page.goto('/posts/visual-journey')
  await expect(page.locator('.reader')).toContainText('Visual journey content')
  await audit(page, info, 'reader')
  await assertTypography(page.locator('.reader-body'))
  initial.set('reader', await capturePresentation(page.locator('.reader-body'), info, `${prefix}-initial-reader`))
  await page.getByRole('link', { name: site.search, exact: true }).click()
  await page.getByRole('searchbox').fill('Visual journey')
  await page.getByRole('button', { name: site.search, exact: true }).click()
  await page.getByRole('link', { name: 'Visual journey article' }).click()
  await expect(page.locator('.reader')).toContainText('Visual journey content')
  await page.getByRole('link', { name: site.licenses, exact: true }).click()
  await audit(page, info, 'licenses')
  await publicLinks(page)
  await expect(page.locator('main')).toContainText(/licenses/i)
  await page.getByRole('link', { name: 'zeithrold/blog', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.getByRole('link', { name: 'Visual journey article' }).click()
  await expect(page.locator('.reader')).toContainText('Visual journey content')
  await audit(page, info, 'final-reader')
  const laterReader = await capturePresentation(page.locator('.reader-body'), info, `${prefix}-late-reader`)
  expectPresentation(laterReader, initial.get('reader'))
}

async function publicLinks(page: Page): Promise<void> {
  await expect(page.getByRole('link', { name: 'GitHub', exact: true }))
    .toHaveAttribute('href', 'https://github.com/zeithrold/blog')
  await expect(page.getByRole('link', { name: 'hello@ztd.me', exact: true }))
    .toHaveAttribute('href', 'mailto:hello@ztd.me')
  const sources = page.locator('main a')
  const expected = [
    '/licenses/third-party-notices.txt',
    '/licenses/sbom.json',
    'https://github.com/kieler/elkjs/tree/a8304cf79fde75bc2ab1a89d28320f53f8637436',
    'https://github.com/eclipse/elk',
    'https://registry.npmjs.org/@blocknote/core/-/core-0.55.0.tgz',
    'https://registry.npmjs.org/@blocknote/react/-/react-0.55.0.tgz',
    'https://www.mozilla.org/en-US/MPL/2.0/',
    'https://github.com/zeithrold/tools/tree/6f1ab6f1e820b7e498c95c11bed7bdd81378eb46/packages/ui',
  ]
  expect(await sources.evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual(expected)
  for (const href of expected.filter(value => value.startsWith('/'))) {
    expect((await page.request.get(href)).status()).toBe(200)
  }
  const rss = await page.request.get('/rss.xml')
  expect(rss.status()).toBe(200)
  expect(await rss.text()).toContain('<rss')
  const skip = page.locator('a[href="#ztd-main"]')
  await skip.focus()
  await skip.press('Enter')
  await expect(page.locator('#ztd-main')).toBeFocused()
}
