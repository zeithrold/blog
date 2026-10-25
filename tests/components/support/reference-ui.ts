import type { Locator, Page, TestInfo } from '@playwright/test'
import type { ComponentLocale } from '../src/contract'
import { expect } from '@playwright/test'
import { assertAccessible } from '~/tests/support/browser/accessibility'
import { settingsTab } from '~/tests/support/browser/settings'
import { editorReady } from './editor-workspace-ui'

/**
 * The document settings section that holds the reference list. The editor keeps
 * its settings beside the body on wide layouts and behind the settings drawer
 * below 1100px; both are the same tabs, so the list is found the same way once
 * the loaded editor owns its settings.
 */
export async function openReferenceList(page: Page, locale: ComponentLocale = 'en'): Promise<Locator> {
  await editorReady(page, locale)
  await settingsTab(page, 'Content')
  const list = page.locator('.reference-settings')
  await list.getByRole('button', { name: /^References \(/u }).click()
  return list
}

/**
 * Opens the editor for a new reference and waits until it is interactive.
 *
 * On wide layouts it is its own dialog; in the drawer it is the drawer's page,
 * whose title names it the same way, so a case only has to look for the dialog
 * called `Add reference`. The page is ready when its enter animation has
 * finished and the form holds focus in the DOI field: filling a field before
 * that lands the value in a control the opening frame is still replacing, and a
 * later render then writes the draft's empty value back over it.
 */
export async function addReference(page: Page, list: Locator): Promise<Locator> {
  await list.getByRole('button', { name: 'Add reference', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Add reference', exact: true })
  await expect(editor).toBeVisible()
  await settled(editor)
  await expect(editor.getByLabel('DOI', { exact: true })).toBeFocused()
  return editor
}

/**
 * The draft coordinator committed the save. Below 1100px the settings drawer is
 * modal over the header, so the save badge sits in an `aria-hidden` subtree and
 * cannot be read by role; its own state attribute is the same committed fact.
 */
export async function draftCommitted(page: Page): Promise<void> {
  await expect(page.locator('.admin-save-status')).toHaveAttribute('data-status', 'saved', { timeout: 15000 })
  await expect(page.locator('[role="alert"]')).toHaveCount(0)
}

/** Settles the native dialog animation before a case measures it. */
export async function settled(dialog: Locator): Promise<void> {
  await expect(dialog).toHaveCSS('opacity', '1')
  await dialog.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map(async animation => await animation.finished.catch(() => {})))
  })
}

/**
 * The reference form keeps its fields inside the dialog at every width: Year and
 * URL share the wide row, and the narrow layout stacks Year under the DOI.
 */
export async function dialogLayout(
  editor: Locator,
  page: Page,
  info: TestInfo,
  width: number,
): Promise<void> {
  await settled(editor)
  const viewport = page.viewportSize()
  if (viewport === null) {
    throw new Error('Missing viewport bounds')
  }
  const box = await editor.boundingBox()
  if (box === null) {
    throw new Error('Missing reference dialog bounds')
  }
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(width)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
  const year = await editor.getByLabel('Year', { exact: true }).boundingBox()
  const doi = await editor.getByLabel('DOI', { exact: true }).boundingBox()
  if (year === null || doi === null) {
    throw new Error('Missing field bounds')
  }
  if (width > 600) {
    const url = await editor.getByLabel('URL', { exact: true }).boundingBox()
    expect(Math.abs(year.y - (url?.y ?? 0))).toBeLessThanOrEqual(1)
  }
  else {
    expect(year.y).toBeGreaterThan(doi.y)
  }
  await assertAccessible(page, info, { label: `reference-dialog-${width}` })
  await page.screenshot({ path: info.outputPath(`reference-dialog-${width}.png`) })
}

/** The lookup message: what the DOI request found, or what it is missing. */
export function lookupStatus(dialog: Locator): Locator {
  return dialog.getByRole('status').filter({ hasText: /Information retrieved|Some information/u })
}
