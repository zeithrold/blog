import type { Locator, Page, TestInfo } from '@playwright/test'
import type { Block, Document } from '@/content/document'
import { emptyDocument, validateDocument } from '@/content/document'
import { writeDocument } from '~/tests/support/browser/document'
import { settle } from '~/tests/support/browser/journey-layout'
import { horizontalBounds } from '~/tests/support/browser/layout'
import { draftPreview } from '~/tests/support/browser/preview'
import { readerCodeColors, readerTypography } from '~/tests/support/browser/reader-presentation'
import { expect, test } from '~/tests/support/browser/test'

const source = `const journey = true\n\tconsole.log("<img src=x onerror=alert(1)>")\n// ${'long code '.repeat(35)}\n`

function block(type: Block['type'], text: string, props: Block['props'] = {}): Block {
  const textProps = { textAlignment: 'left', textColor: 'default', backgroundColor: 'default' }
  return { id: crypto.randomUUID(), type, props: type === 'codeBlock' ? props : { ...textProps, ...props }, content: [
    { type: 'text', text, styles: {} },
  ], children: [] }
}

function documentFixture(width: number, language = 'typescript'): Document {
  const document = emptyDocument()
  document.meta.title = 'Reading headings and code'
  document.meta.slug = `reader-typography-${crypto.randomUUID()}`
  document.meta.documentLocale = width === 390 ? 'zh-CN' : 'en'
  const nested = block('bulletListItem', 'Nested bullet')
  nested.children = [
    block('numberedListItem', 'Nested number', { start: 4 }),
  ]
  const completed = block('checkListItem', 'Finished task', { checked: true })
  completed.children = [
    block('paragraph', 'Nested task description'),
  ]
  document.blocks = [
    block('paragraph', 'Body text and spacing'),
    ...[
      1,
      2,
      3,
    ].map(level => block('heading', `Heading 标题 ${level}`, { level })),
    nested,
    block('numberedListItem', 'Number four', { start: 4 }),
    block('numberedListItem', 'Number five'),
    taskLink('Before tasks'),
    completed,
    block('checkListItem', 'Pending task with a long description that wraps on narrow screens. '.repeat(3), {
      checked: false,
    }),
    taskLink('After tasks'),
    block('codeBlock', source, { language }),
    block('paragraph', 'After the code'),
  ]
  return validateDocument(document)
}

function taskLink(text: string): Block {
  return {
    ...block('paragraph', ''),
    content: [
      { type: 'link', href: '#', content: [
        { type: 'text', text, styles: {} },
      ] },
    ],
  }
}

async function readonlyTasks(root: Locator): Promise<void> {
  const tasks = root.getByRole('checkbox')
  await expect(tasks).toHaveCount(2)
  await expect(tasks.first()).toHaveAccessibleName('Finished task')
  await expect(tasks.first()).toBeChecked()
  await expect(tasks.last()).not.toBeChecked()
  await expect(root.getByText('Nested task description', { exact: true })).toBeVisible()
  for (const task of await tasks.all()) {
    await expect(task).toBeDisabled()
    await expect(task).toHaveClass(/ztd-checkbox/)
    await expect(task).toHaveCSS('width', '24px')
    await expect(task).toHaveCSS('height', '24px')
    await horizontalBounds(root.page(), task)
  }
}

async function capture(page: Page, info: TestInfo, name: string): Promise<void> {
  await settle(page)
  const path = info.outputPath(`${name}.png`)
  await page.screenshot({ path })
  await info.attach(name, { path, contentType: 'image/png' })
}

async function checkReader(root: Locator): Promise<Locator> {
  await readerTypography(root)
  await readonlyTasks(root)
  const sizes = await root.locator('h2, h3, h4').evaluateAll(elements =>
    elements.map(element => Number.parseFloat(getComputedStyle(element).fontSize)))
  expect(sizes).toHaveLength(3)
  expect(sizes[0]).toBeGreaterThan(sizes[1] ?? 0)
  expect(sizes[1]).toBeGreaterThan(sizes[2] ?? 0)
  const pre = root.locator('pre[data-language="typescript"]')
  await readerCodeColors(pre)
  expect(await pre.locator('code').textContent()).toBe(source)
  await expect(pre.locator('img, script')).toHaveCount(0)
  expect(await pre.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true)
  await horizontalBounds(root.page(), pre)
  await expect(root.locator('ol[start="4"]').last().locator(':scope > li')).toHaveCount(2)
  return pre
}

for (const width of [
  1440,
  390,
  320,
]) {
  test(`reader headings, list markers and highlighted code survive preview and publication at ${width}px`, async ({
    page,
    browserName,
  }, info) => {
    await page.setViewportSize({ width, height: 1000 })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    const document = documentFixture(width)
    await writeDocument(page, document)
    const preview = await draftPreview(page)
    await checkReader(preview.locator('.reader-body'))
    await capture(page, info, 'reader-preview')
    await preview.getByRole('button', { name: 'Close preview', exact: true }).click()
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Update publication', exact: true })).toBeVisible()
    await page.goto(`/posts/${document.meta.slug}`)
    const pre = await checkReader(page.locator('.reader-body'))
    await page.getByRole('link', { name: 'Before tasks', exact: true }).focus()
    await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab')
    await expect(page.getByRole('link', { name: 'After tasks', exact: true })).toBeFocused()
    const keyword = pre.locator('.reader-code-token').filter({ hasText: /^const$/ })
    const light = await keyword.evaluate(element => getComputedStyle(element).color)
    await capture(page, info, 'reader-light')
    await page.getByRole('button', { name: 'Appearance', exact: true }).click()
    await page.getByRole('menuitemradio', { name: 'Dark', exact: true }).click()
    await expect.poll(async () => await keyword.evaluate(element => getComputedStyle(element).color)).not.toBe(light)
    await checkReader(page.locator('.reader-body'))
    await capture(page, info, 'reader-dark')
    await page.reload()
    await checkReader(page.locator('.reader-body'))
    expect(errors).toEqual([])
  })
}

for (const language of ['text', 'legacy-lang']) {
  test(`reader preserves unhighlighted ${language} source as literal text`, async ({ page }) => {
    await writeDocument(page, documentFixture(1440, language))
    const preview = await draftPreview(page)
    const pre = preview.locator(`pre[data-language="${language}"]`)
    expect(await pre.locator('code').textContent()).toBe(source)
    await expect(pre.locator('.reader-code-token, img, script')).toHaveCount(0)
    await readerTypography(preview.locator('.reader-body'))
  })
}
