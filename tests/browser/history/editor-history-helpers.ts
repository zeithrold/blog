import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { openDocumentSchema } from '@/contracts/documents'
import { historyPosition } from '@/shared/admin/history-navigation'
import { writeDocument } from '~/tests/support/browser/document'
import { fixture } from '~/tests/support/browser/document-fixture'

export async function historyEditor(page: Page, direction: 'back' | 'forward'): Promise<{
  documentId: string
  title: string
  length: number
}> {
  const document = fixture('A history navigation document')
  document.meta.title = `History ${crypto.randomUUID()}`
  const original = await writeDocument(page, document)
  await page.getByRole('link', { name: 'Tags', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tags', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Documents', exact: true }).click()
  await page.getByRole('link', { name: document.meta.title, exact: true }).click()
  await expect(page.getByLabel('Document body', { exact: true })).toBeVisible()
  if (direction === 'forward') {
    await page.getByRole('link', { name: 'Tags', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Tags', exact: true })).toBeVisible()
    await page.goBack()
    await expect(page.getByLabel('Document body', { exact: true })).toBeVisible()
  }
  return {
    documentId: original.documentId,
    title: document.meta.title,
    length: await page.evaluate(() => history.length),
  }
}

export async function historyDocument(
  page: Page,
  documentId: string,
): Promise<ReturnType<typeof openDocumentSchema.parse>> {
  return openDocumentSchema.parse(await (await page.request.get(`/api/admin/documents/${documentId}`)).json())
}

export async function holdSave(page: Page): Promise<() => void> {
  let release = (): void => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/revisions', async (route) => {
    await held
    await route.continue()
  })
  return release
}

export async function historyIndex(page: Page): Promise<number> {
  const state: unknown = await page.evaluate((): unknown => history.state)
  return historyPosition(state)?.index ?? -1
}
