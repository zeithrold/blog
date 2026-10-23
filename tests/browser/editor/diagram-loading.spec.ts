import type { Locator, Page, TestInfo } from '@playwright/test'
import { emptyDocument } from '@/content/document'
import { publication as en } from '@/i18n/resources/en/publication'
import { site as enSite } from '@/i18n/resources/en/site'
import { publication as zh } from '@/i18n/resources/zh-CN/publication'
import { site as zhSite } from '@/i18n/resources/zh-CN/site'
import { writeDocument } from '~/tests/support/browser/document'
import { settle } from '~/tests/support/browser/journey-layout'
import { horizontalBounds } from '~/tests/support/browser/layout'
import { expect, test } from '~/tests/support/browser/test'
import { richDocument } from './rich-fixture'

async function holdReadyMessages(page: Page): Promise<void> {
  // Keep the real renderer running, but hold its readiness handshake to expose
  // the interval where a sandbox contains SVG and must still be concealed.
  await page.addInitScript(() => {
    let paused = true
    const pending: MessageEvent<unknown>[] = []
    window.addEventListener('message', (event) => {
      const data: unknown = event.data
      if (!paused || event.origin !== 'null' || data === null || typeof data !== 'object'
        || !('state' in data) || data.state !== 'ready') {
        return
      }
      event.stopImmediatePropagation()
      pending.push(event)
      Reflect.set(window, '__diagramReadyCount', pending.length)
    }, true)
    Reflect.set(window, '__diagramReadyCount', 0)
    window.addEventListener('__release-diagram-ready', () => {
      paused = false
      for (const event of pending.splice(0)) {
        window.dispatchEvent(new MessageEvent('message', {
          data: event.data,
          origin: event.origin,
          source: event.source,
        }))
      }
    })
  })
}

async function capture(page: Page, info: TestInfo, name: string): Promise<void> {
  await settle(page)
  const path = info.outputPath(`${name}.png`)
  await page.screenshot({ path })
  await info.attach(name, { path, contentType: 'image/png' })
}

async function top(locator: Locator): Promise<number> {
  return await locator.evaluate(element => element.getBoundingClientRect().top + window.scrollY)
}

async function publish(page: Page, chinese: boolean): Promise<string> {
  const document = emptyDocument()
  document.meta.title = 'A diagram in the article'
  document.meta.slug = `diagram-loading-${crypto.randomUUID()}`
  const paragraph = document.blocks[0]
  if (paragraph === undefined) {
    throw new Error('Missing paragraph')
  }
  paragraph.content = [
    { type: 'text', text: 'After the diagram', styles: {} },
  ]
  document.blocks.unshift({
    id: crypto.randomUUID(),
    type: 'mermaid',
    props: { description: 'How the process works' },
    children: [],
    content: [
      { type: 'text', text: 'graph TD\nA-->B', styles: {} },
    ],
  })
  await writeDocument(page, document)
  if (chinese) {
    await page.getByRole('button', { name: 'Appearance', exact: true }).click()
    await page.getByRole('menuitemradio', { name: 'Dark', exact: true }).click()
    await page.getByRole('combobox', { name: 'Language', exact: true }).click()
    await page.getByRole('option', { name: '简体中文', exact: true }).click()
    await page.reload()
  }
  const copy = chinese ? zh : en
  await page.getByRole('button', { name: copy.publishDraft, exact: true }).click()
  await expect(page.getByRole('button', { name: copy.updatePublication, exact: true })).toBeVisible()
  return `/posts/${document.meta.slug}`
}

for (const width of [
  1440,
  390,
  320,
]) {
  for (const chinese of [false, true]) {
    test(`reader loading at ${width}px ${chinese ? 'zh dark' : 'en light'}`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 1000 })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      const path = await publish(page, chinese)
      await holdReadyMessages(page)
      let release: () => void = () => {}
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      await page.route('**/render/mermaid', async (route) => {
        if (route.request().frame().url().endsWith(path)) {
          await gate
        }
        await route.continue()
      })
      try {
        await page.goto(path)
        const state = await initialLoading(page, info, chinese)
        release()
        const frame = await hiddenRenderer(page, info, state)
        await page.evaluate(() => window.dispatchEvent(new Event('__release-diagram-ready')))
        await readyDiagram(page, info, state, frame)
        expect(errors).toEqual([])
      }
      finally {
        release()
      }
    })
  }
}

async function initialLoading(page: Page, info: TestInfo, chinese: boolean) {
  const figure = page.locator('.reader .diagram')
  const viewport = figure.locator('.diagram-viewport')
  const placeholder = figure.getByRole('status')
  const copy = chinese ? zhSite : enSite
  await figure.scrollIntoViewIfNeeded()
  await expect(figure).toHaveAttribute('aria-busy', 'true')
  await expect(placeholder).toHaveText(copy.diagramLoading)
  await expect(placeholder).toHaveCSS('justify-content', 'center')
  await expect(placeholder).toHaveCSS('align-items', 'center')
  await expect(placeholder.locator('svg')).toHaveCSS('animation-name', 'none')
  await expect(figure.locator('iframe')).toHaveCount(0)
  await horizontalBounds(page, viewport)
  const after = page.getByText('After the diagram', { exact: true })
  const initialTop = await top(after)
  const initialHeight = (await viewport.boundingBox())?.height
  await capture(page, info, 'loading-template')
  return { figure, viewport, placeholder, after, initialTop, initialHeight }
}

type LoadingState = Awaited<ReturnType<typeof initialLoading>>

async function hiddenRenderer(page: Page, info: TestInfo, state: LoadingState): Promise<Locator> {
  const { figure, viewport, after, initialHeight, initialTop } = state
  await expect.poll(async () => await page.evaluate(() => {
    const count: unknown = Reflect.get(window, '__diagramReadyCount')
    return typeof count === 'number' ? count : 0
  })).toBeGreaterThan(0)
  const frame = figure.locator('iframe')
  await expect(page.frameLocator('iframe[title="How the process works"]').locator('svg')).toBeAttached()
  await expect(frame).toBeHidden()
  await expect(frame).toHaveAttribute('aria-hidden', 'true')
  await expect(frame).toHaveAttribute('inert', '')
  await expect(frame).toHaveAttribute('tabindex', '-1')
  await expect(frame).toHaveCSS('border-top-width', '0px')
  await expect(figure).toHaveAttribute('aria-busy', 'true')
  expect((await viewport.boundingBox())?.height).toBe(initialHeight)
  expect(await top(after)).toBeCloseTo(initialTop, 0)
  await capture(page, info, 'loading-renderer')
  return frame
}

async function readyDiagram(page: Page, info: TestInfo, state: LoadingState, frame: Locator): Promise<void> {
  const { figure, viewport, placeholder, after, initialTop } = state
  await expect(figure).toHaveAttribute('aria-busy', 'false')
  await expect(frame).toBeVisible()
  await expect(frame).not.toHaveAttribute('aria-hidden')
  await expect(frame).not.toHaveAttribute('inert')
  await expect(placeholder).toHaveCount(0)
  await expect(frame).toHaveCSS('border-top-width', '0px')
  expect(await top(after)).toBeCloseTo(initialTop, 0)
  await expect(figure.locator('figcaption')).toHaveText('How the process works')
  await horizontalBounds(page, viewport)
  await capture(page, info, 'diagram-ready')
}

test('loading diagrams preserve reference settings and native blocks', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 1000 })
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/render/mermaid', async (route) => {
    await gate
    await route.continue()
  })
  try {
    await writeDocument(page, richDocument())
    const body = page.getByLabel('Document body', { exact: true })
    await expect(body.locator('.diagram-placeholder')).toHaveCount(1)
    const marker = body.locator('[data-inline-content-type="citation"] .inline-reference-marker')
    await marker.locator('span').click()
    const panel = page.getByRole('dialog', { name: 'Citation reference', exact: true })
    await expect(panel).toBeVisible()
    await expect(marker).toHaveAttribute('data-state', 'open')
    await expect(body.locator('[data-id][aria-hidden="true"]')).toHaveCount(0)
    await panel.getByRole('textbox', { name: 'Citation locator', exact: true }).fill('p. 7')
    await capture(page, info, 'editor-loading-reference-settings')
    await panel.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(marker).toBeFocused()
    release()
    await body.locator('[data-content-type="mermaid"]').scrollIntoViewIfNeeded()
    await expect(page.frameLocator('iframe[title="Safe diagram"]').locator('svg')).toBeVisible({ timeout: 15000 })
    await marker.locator('span').click()
    await expect(panel).toBeVisible()
    await expect(panel.getByRole('textbox', { name: 'Citation locator', exact: true })).toHaveValue('p. 7')
    await panel.getByRole('button', { name: 'Done', exact: true }).click()
  }
  finally {
    release()
  }
})
