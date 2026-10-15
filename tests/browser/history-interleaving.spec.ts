import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { historyDocument, historyEditor, historyIndex, holdSave } from './editor-history-helpers'
import { saved } from './helpers'
import { holdRepair, interleavingProbe } from './history-interleaving-helpers'

const pageErrors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => {
  const errors: string[] = []
  pageErrors.set(page, errors)
  page.on('pageerror', error => errors.push(error.message))
})
test.afterEach(({ page }) => {
  expect(pageErrors.get(page)).toEqual([])
})

test('two destination pops before restoration preserve the latest Back destination', async ({ page }, info) => {
  await interleavingProbe(page)
  const original = await historyEditor(page, 'back')
  const source = await historyIndex(page)
  const release = await holdSave(page)
  try {
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Latest interleaved intent')
    await page.evaluate((position) => {
      window.historyProbe.source = position
      window.historyProbe.armed = true
      window.historyProbe.holding = true
      history.back()
    }, source)
    await expect.poll(async () => await page.evaluate(() => window.historyProbe.repairs.length)).toBe(2)
    await page.evaluate(() => window.historyProbe.release())
    await expect(page.getByRole('dialog', { name: 'Saving before leaving', exact: true })).toBeVisible()
    await expect.poll(async () => await historyIndex(page)).toBe(source)
    const probe = await page.evaluate(() => ({
      pops: window.historyProbe.pops,
      repairs: window.historyProbe.repairs,
    }))
    await info.attach('history-interleaving', { body: JSON.stringify(probe), contentType: 'application/json' })
    expect(probe.pops).toContain(source - 1)
    expect(probe.pops).toContain(source - 2)
    expect(await historyIndex(page)).toBe(source)
    release()
    await expect.poll(async () => await historyIndex(page)).toBe(source - 2)
    await expect(page.getByRole('heading', { name: 'Tags', exact: true })).toBeVisible()
    expect(await page.evaluate(() => history.length)).toBe(original.length)
  }
  finally { release() }
})

test('Stay here during a second restoration cancels that traversal before its repair arrives', async ({ page }) => {
  await interleavingProbe(page)
  const original = await historyEditor(page, 'forward')
  const source = await historyIndex(page)
  const release = await holdSave(page)
  try {
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Cancel the newest restoration')
    await page.evaluate(() => history.back())
    const dialog = page.getByRole('dialog', { name: 'Saving before leaving', exact: true })
    await expect(dialog).toBeVisible()
    await expect.poll(async () => await historyIndex(page)).toBe(source)
    await holdRepair(page)
    await page.evaluate(() => history.forward())
    await expect.poll(async () => await page.evaluate(() => window.historyProbe.pending.length)).toBe(1)
    expect(await historyIndex(page)).toBe(source + 1)
    await dialog.getByRole('button', { name: 'Stay here', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await page.evaluate(() => window.historyProbe.release())
    await expect.poll(async () => await historyIndex(page)).toBe(source)
    await expect(dialog).toHaveCount(0)
    release()
    await saved(page)
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Cancel the newest restoration')
    expect(await historyIndex(page)).toBe(source)
    expect(await page.evaluate(() => history.length)).toBe(original.length)
    expect((await historyDocument(page, original.documentId)).document.meta.title).toBe('Cancel the newest restoration')
  }
  finally { release() }
})

test('a delayed approved traversal cannot displace a newer clean browser destination', async ({ page }) => {
  await interleavingProbe(page)
  const original = await historyEditor(page, 'back')
  const source = await historyIndex(page)
  const release = await holdSave(page)
  try {
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Approved before newer navigation')
    await page.evaluate(() => history.back())
    await expect(page.getByRole('dialog', { name: 'Saving before leaving', exact: true })).toBeVisible()
    await holdRepair(page)
    release()
    await expect.poll(async () => await page.evaluate(() => window.historyProbe.pending.length)).toBe(1)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.evaluate(() => history.back())
    await expect(page.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible()
    await page.evaluate(() => history.back())
    await expect(page.getByRole('heading', { name: 'Tags', exact: true })).toBeVisible()
    expect(await historyIndex(page)).toBe(source - 2)
    await page.evaluate(() => window.historyProbe.release())
    await expect.poll(async () => await page.evaluate(() => window.historyProbe.pops.length))
      .toBeGreaterThanOrEqual(4)
    await expect.poll(async () => await historyIndex(page)).toBe(source - 2)
    await expect(page.getByRole('heading', { name: 'Tags', exact: true })).toBeVisible()
    expect(await page.evaluate(() => history.length)).toBe(original.length)
    expect((await historyDocument(page, original.documentId)).document.meta.title)
      .toBe('Approved before newer navigation')
  }
  finally { release() }
})

test('legacy history restores, cancels and saves an ordinary Back traversal', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'navigation', { value: undefined, configurable: true })
  })
  const original = await historyEditor(page, 'back')
  const source = await historyIndex(page)
  const release = await holdSave(page)
  try {
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Fallback history remains usable')
    await page.evaluate(() => history.back())
    const dialog = page.getByRole('dialog', { name: 'Saving before leaving', exact: true })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Stay here', exact: true }).click()
    release()
    await saved(page)
    expect(await historyIndex(page)).toBe(source)
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Fallback history saved before leaving')
    await page.evaluate(() => history.back())
    await expect(page.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible()
    expect((await historyDocument(page, original.documentId)).document.meta.title)
      .toBe('Fallback history saved before leaving')
    expect(await page.evaluate(() => history.length)).toBe(original.length)
  }
  finally { release() }
})

test('returning to the source during restoration dismisses the pending departure', async ({ page }) => {
  await interleavingProbe(page)
  const original = await historyEditor(page, 'back')
  const source = await historyIndex(page)
  const release = await holdSave(page)
  try {
    await holdRepair(page)
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Forward means stay at this editor')
    await page.evaluate(() => history.back())
    const dialog = page.getByRole('dialog', { name: 'Saving before leaving', exact: true })
    await expect(dialog).toBeVisible()
    await expect.poll(async () => await historyIndex(page)).toBe(source - 1)
    await page.evaluate(() => history.forward())
    await expect.poll(async () => await historyIndex(page)).toBe(source)
    await expect(dialog).toHaveCount(0)
    await page.evaluate(() => window.historyProbe.release())
    release()
    await saved(page)
    expect(await historyIndex(page)).toBe(source)
    expect(await page.evaluate(() => history.length)).toBe(original.length)
  }
  finally { release() }
})

test('a history request supersedes an earlier internal link before restoration completes', async ({ page }) => {
  await interleavingProbe(page)
  const original = await historyEditor(page, 'back')
  const source = await historyIndex(page)
  const release = await holdSave(page)
  try {
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill('History supersedes the sidebar request')
    await page.getByRole('link', { name: 'Tags', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Saving before leaving', exact: true })).toBeVisible()
    await holdRepair(page)
    await page.evaluate(() => history.back())
    await expect.poll(async () => await page.evaluate(() => window.historyProbe.pending.length)).toBe(1)
    release()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: 'Title', exact: true }))
      .toHaveValue('History supersedes the sidebar request')
    expect(await historyIndex(page)).toBe(source - 1)
    await page.evaluate(() => window.historyProbe.release())
    await expect(page.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible()
    expect(await historyIndex(page)).toBe(source - 1)
    expect(await page.evaluate(() => history.length)).toBe(original.length)
    expect((await historyDocument(page, original.documentId)).document.meta.title)
      .toBe('History supersedes the sidebar request')
  }
  finally { release() }
})

test('a branch write drains its rejected repair and later history still works', async ({ page }) => {
  await interleavingProbe(page)
  const original = await historyEditor(page, 'back')
  const release = await holdSave(page)
  try {
    await holdRepair(page)
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Saved before the branch write')
    await page.evaluate(() => history.back())
    await expect.poll(async () => await page.evaluate(() => window.historyProbe.pending.length)).toBe(1)
    release()
    await saved(page)
    await page.getByRole('link', { name: 'Tags', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Tags', exact: true })).toBeVisible()
    await page.evaluate(() => window.historyProbe.release())
    await page.getByRole('link', { name: 'Series', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Series', exact: true })).toBeVisible()
    await page.goBack()
    await expect(page.getByRole('heading', { name: 'Tags', exact: true })).toBeVisible()
    expect((await historyDocument(page, original.documentId)).document.meta.title).toBe('Saved before the branch write')
  }
  finally { release() }
})
