import { assertAccessible } from '~/tests/support/browser/accessibility'
import { saved } from '~/tests/support/browser/document'
import { withinViewport } from '~/tests/support/browser/layout'
import { expect, test } from '~/tests/support/browser/test'
import { historyDocument, historyEditor, historyIndex, holdSave } from './editor-history-helpers'

test('cancel and Escape keep the editor at its history entry despite a late save', async ({ page }) => {
  const original = await historyEditor(page, 'back')
  const release = await holdSave(page)
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Kept after cancelling history')
  for (const escape of [false, true]) {
    await page.evaluate(() => history.back())
    const dialog = page.getByRole('dialog', { name: 'Saving before leaving', exact: true })
    await expect(dialog).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/admin/documents/${original.documentId}$`))
    if (escape) {
      await page.keyboard.press('Escape')
    }
    else {
      await dialog.getByRole('button', { name: 'Stay here', exact: true }).click()
    }
    await expect(dialog).toHaveCount(0)
  }
  release()
  await saved(page)
  await expect(page).toHaveURL(new RegExp(`/admin/documents/${original.documentId}$`))
  expect(await page.evaluate(() => history.length)).toBe(original.length)
  expect((await historyDocument(page, original.documentId)).document.meta.title).toBe('Kept after cancelling history')
})

for (const retry of [true, false]) {
  test(`a failed browser traversal can ${retry ? 'retry saving' : 'explicitly leave'} without adding history`, async ({
    page,
  }, info) => {
    const original = await historyEditor(page, 'back')
    if (retry) {
      await page.setViewportSize({ width: 320, height: 900 })
      await page.getByRole('combobox', { name: 'Language', exact: true }).click()
      await page.getByRole('option', { name: '简体中文', exact: true }).click()
    }
    await page.route('**/revisions', async route => await route.fulfill({
      status: 503,
      json: { code: 'CONNECTION_FAILED' },
    }))
    await page.getByRole('textbox', { name: retry ? '标题' : 'Title', exact: true }).fill('History failure edit')
    await page.evaluate(() => history.back())
    const dialog = page.getByRole('dialog', { name: retry ? '离开前保存' : 'Save before leaving', exact: true })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('alert')).not.toContainText('CONNECTION_FAILED')
    await expect(page).toHaveURL(new RegExp(`/admin/documents/${original.documentId}$`))
    await withinViewport(page, dialog)
    await assertAccessible(page, info, { label: `history-save-failure-${String(retry)}` })
    if (retry) {
      await page.unroute('**/revisions')
    }
    await dialog.getByRole('button', { name: retry ? '重试保存' : 'Leave without saving', exact: true }).click()
    await expect(page.getByRole('heading', { name: retry ? '文档' : 'Documents', exact: true })).toBeVisible()
    expect(await page.evaluate(() => history.length)).toBe(original.length)
    expect((await historyDocument(page, original.documentId)).document.meta.title)
      .toBe(retry ? 'History failure edit' : original.title)
  })
}

test('a newer opposite traversal replaces the destination during a save', async ({ page }) => {
  const original = await historyEditor(page, 'forward')
  const release = await holdSave(page)
  let writes = 0
  page.on('request', (request) => {
    if (request.method() === 'PUT' && request.url().endsWith('/revisions')) {
      writes++
    }
  })
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Latest history intent')
  await page.evaluate(() => history.back())
  const dialog = page.getByRole('dialog', { name: 'Saving before leaving', exact: true })
  await expect(dialog).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/admin/documents/${original.documentId}$`))
  await page.evaluate(() => history.forward())
  await expect(page).toHaveURL(new RegExp(`/admin/documents/${original.documentId}$`))
  await expect.poll(() => writes).toBe(1)
  release()
  await expect(page.getByRole('heading', { name: 'Tags', exact: true })).toBeVisible()
  expect(writes).toBe(1)
  expect(await page.evaluate(() => history.length)).toBe(original.length)
})

test('rapid repeated Back requests can be cancelled without a late history jump', async ({ page }) => {
  const original = await historyEditor(page, 'back')
  const release = await holdSave(page)
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Rapid history stays here')
  await page.evaluate(() => {
    history.back()
    history.back()
  })
  const dialog = page.getByRole('dialog', { name: 'Saving before leaving', exact: true })
  await expect(dialog).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/admin/documents/${original.documentId}$`))
  await dialog.getByRole('button', { name: 'Stay here', exact: true }).click()
  release()
  await saved(page)
  await expect(dialog).toHaveCount(0)
  await expect(page).toHaveURL(new RegExp(`/admin/documents/${original.documentId}$`))
  expect(await page.evaluate(() => history.length)).toBe(original.length)
})

test('leaving across a native hash entry saves first and restores the full traversal distance', async ({ page }) => {
  const original = await historyEditor(page, 'back')
  const index = await historyIndex(page)
  await page.evaluate(() => {
    location.hash = 'heading'
  })
  await expect.poll(async () => await historyIndex(page)).toBe(index + 1)
  const release = await holdSave(page)
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('History after native hash')
  await page.evaluate(() => history.go(-2))
  const dialog = page.getByRole('dialog', { name: 'Saving before leaving', exact: true })
  await expect(dialog).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/admin/documents/${original.documentId}#heading$`))
  release()
  await expect(page.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible()
  expect(await historyIndex(page)).toBe(index - 1)
  expect(await page.evaluate(() => history.length)).toBe(original.length + 1)
  await page.evaluate(() => history.go(2))
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('History after native hash')
})

test('same-document query history receives the save guard and does not add a route entry', async ({ page }) => {
  const original = await historyEditor(page, 'back')
  await page.evaluate(() => history.pushState(history.state, '', `${location.pathname}?view=other`))
  const release = await holdSave(page)
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('History query edit')
  await page.evaluate(() => history.back())
  const dialog = page.getByRole('dialog', { name: 'Saving before leaving', exact: true })
  await expect(dialog).toBeVisible()
  await expect(page).toHaveURL(/\?view=other$/)
  release()
  await expect(page).toHaveURL(new RegExp(`/admin/documents/${original.documentId}$`))
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('History query edit')
  expect(await page.evaluate(() => history.length)).toBe(original.length + 1)
})

test('a history branch and multi-step traversal use actual positions despite router index gaps', async ({ page }) => {
  const original = await historyEditor(page, 'back')
  const source = await historyIndex(page)
  await page.getByRole('link', { name: 'Tags', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tags', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Series', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Series', exact: true })).toBeVisible()
  await page.evaluate(() => history.go(-2))
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(original.title)
  await page.getByRole('link', { name: 'Documents', exact: true }).click()
  await page.getByRole('link', { name: original.title, exact: true }).click()
  await expect(page.getByLabel('Document body', { exact: true })).toBeVisible()
  const length = await page.evaluate(() => history.length)
  const release = await holdSave(page)
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Branched history edit')
  await page.evaluate(() => history.go(-2))
  const dialog = page.getByRole('dialog', { name: 'Saving before leaving', exact: true })
  await expect(dialog).toBeVisible()
  expect(await historyIndex(page)).toBe(source + 2)
  release()
  await expect.poll(async () => await historyIndex(page)).toBe(source)
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Branched history edit')
  expect(await page.evaluate(() => history.length)).toBe(length)
})
