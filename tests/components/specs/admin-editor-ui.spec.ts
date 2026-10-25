import type { Locator, Page } from '@playwright/test'
import type { OpenDocument } from '@/contracts/documents'
import { blockActions, fixture as blockDocument, reveal } from '~/tests/browser/editor/blocks/block-action-helpers'
import { saved } from '~/tests/support/browser/document'
import { withinViewport } from '~/tests/support/browser/layout'
import { settingsTab } from '~/tests/support/browser/settings'
import {
  openWorkspace,
  publicationAck,
  serveWorkspace,
} from '../support/editor-workspace-case'
import { editorWorkspaceDocument } from '../support/editor-workspace-fixtures'
import { expect, test } from '../support/test'

/** A document whose body comes from this case, not from the shared seed. */
function workspaceWith(title: string, body: OpenDocument['document']): OpenDocument {
  return { ...editorWorkspaceDocument(title), document: body }
}

async function language(page: Page, name: 'English' | '简体中文'): Promise<void> {
  await page.getByRole('combobox', { name: /^(Language|语言)$/ }).click()
  await page.getByRole('option', { name, exact: true }).click()
}

// The published state is what the header action reads: a fresh draft offers
// Publish and a disabled draft sync, and a live revision turns it into an update.
test('publication actions describe the live state and draft sync stays in the menu', async ({ page }, info) => {
  const api = await serveWorkspace(page, editorWorkspaceDocument('Publication action labels'), {
    'POST /api/admin/documents/:id/publish': () => ({ body: publicationAck() }),
  })
  try {
    await openWorkspace(page, { title: 'Publication action labels', width: 1440 })
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
    await page.screenshot({ path: info.outputPath('admin-editor-actions-zh.png') })
    await language(page, 'English')
    await expect(page.getByRole('button', { name: 'Update publication', exact: true })).toBeVisible()
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

// Clicking into the writing surface is how an author dismisses the header menu,
// and the editor has to stay focused and editable afterwards.
test('clicking the document body outside its desktop actions menu preserves the writing focus', async ({ page }) => {
  const api = await serveWorkspace(page, editorWorkspaceDocument('Document menu focus'))
  try {
    await openWorkspace(page, { title: 'Document menu focus', width: 1440 })
    const body = page.getByLabel('Document body', { exact: true })
    await page.getByRole('button', { name: 'More document actions', exact: true }).click()
    await expect(page.getByRole('menu')).toBeVisible()
    await body.click()
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(body).toBeFocused()
    await body.pressSequentially('Continue writing after dismissing the actions menu')
    await saved(page)
    await expect(body).toContainText('Continue writing after dismissing the actions menu')
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

/**
 * The native dialog animation is measured frame by frame: at every sampled time
 * the dialog's centre has to stay on the viewport centre, in both directions.
 */
async function centeredFrames(dialog: Locator, state: 'open' | 'closed'): Promise<void> {
  await expect(dialog).toHaveAttribute('data-state', state)
  const frames = await dialog.evaluate((element, currentState) => {
    const name = `ztd-dialog-${currentState === 'open' ? 'enter' : 'exit'}`
    const animation = element.getAnimations().find(candidate =>
      candidate instanceof CSSAnimation && candidate.animationName === name,
    )
    const duration = animation?.effect?.getTiming().duration
    if (animation === undefined || typeof duration !== 'number') {
      throw new Error(`Missing ${currentState} dialog animation`)
    }
    const samples = [
      0,
      duration / 2,
      duration - 1,
    ].map((time) => {
      animation.currentTime = time
      const rect = element.getBoundingClientRect()
      return {
        time,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        expectedX: window.innerWidth / 2,
        expectedY: window.innerHeight / 2,
      }
    })
    animation.finish()
    return samples
  }, state)
  for (const frame of frames) {
    expect(Math.abs(frame.centerX - frame.expectedX), `${state} at ${frame.time}ms: horizontal center`).toBeLessThan(1)
    expect(Math.abs(frame.centerY - frame.expectedY), `${state} at ${frame.time}ms: vertical center`).toBeLessThan(1)
  }
}

for (const width of [390, 1440]) {
  test(`dialog remains centered throughout opening and closing at ${width}px`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    const api = await serveWorkspace(page, editorWorkspaceDocument('Dialog positioning regression'))
    try {
      await openWorkspace(page, { title: 'Dialog positioning regression', width, height: 740 })
      await settingsTab(page, 'Content')
      // Pause the native CSS animation before opening so its first painted frame
      // is inspectable; the harness page needs no CSP nonce to add it.
      await page.addStyleTag({ content: '.ztd-dialog { animation-play-state: paused !important; }' })
      const trigger = page.getByRole('button', { name: 'Preview', exact: true })
      await trigger.click()
      const dialog = page.locator('.draft-preview-dialog')
      await expect(dialog).toBeVisible()
      await centeredFrames(dialog, 'open')
      await expect(dialog.getByRole('button', { name: 'Close preview', exact: true })).toBeFocused()
      await dialog.getByRole('button', { name: 'Close preview', exact: true }).click()
      await centeredFrames(dialog, 'closed')
      await expect(dialog).toHaveCount(0)
      await expect(trigger).toBeFocused()
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

/** Opens the settings drawer on the catalog section the case measures. */
async function openCatalogInspector(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Document settings', exact: true }).click()
  await page.getByText('Tags and series', { exact: true }).click()
  return page.getByRole('dialog', { name: 'Document settings', exact: true })
}

for (const width of [320, 700]) {
  test(`settings retain one scroll container and plain catalog fields at ${width}px`, async ({ page }, info) => {
    const api = await serveWorkspace(page, editorWorkspaceDocument('A single scrolling inspector'))
    try {
      await openWorkspace(page, { title: 'A single scrolling inspector', width, height: 740 })
      const drawer = await openCatalogInspector(page)
      const scroll = drawer.getByRole('region', { name: 'Document settings', exact: true })
      await expect(drawer).toHaveCSS('overflow-y', 'clip')
      await expect(drawer.locator('.catalog-selection fieldset')).toHaveCount(0)
      await expect(drawer.locator('.catalog-field')).toHaveCount(2)
      const scrollers = await drawer.evaluate(element => [
        element,
        ...element.querySelectorAll('*'),
      ]
        .filter((node) => {
          const style = getComputedStyle(node)
          return ['auto', 'scroll'].includes(style.overflowY)
            && node.clientHeight > 0 && node.scrollHeight > node.clientHeight + 1
        })
        .map(node => node.getAttribute('class') ?? ''))
      expect(scrollers).toHaveLength(1)
      expect(scrollers[0]).toContain('ztd-scroll-viewport')
      await scroll.evaluate((element) => {
        element.scrollTop = element.scrollHeight
      })
      await expect.poll(async () => await scroll.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
      await drawer.evaluate((element) => {
        element.scrollTop = element.scrollHeight
      })
      expect(await drawer.evaluate(element => element.scrollTop)).toBe(0)
      await expect(drawer.getByRole('heading', { name: 'Document settings', exact: true })).toBeInViewport()
      await expect(drawer.getByRole('button', { name: 'Close', exact: true })).toBeInViewport()
      for (const name of ['Tags', 'Series']) {
        const control = drawer.getByRole('combobox', { name, exact: true })
        await expect(control).toBeVisible()
        const id = await control.getAttribute('id')
        if (id === null) {
          throw new Error('The catalog control must have an associated label')
        }
        await expect(drawer.locator('label').filter({ hasText: new RegExp(`^${name}$`) })).toHaveAttribute('for', id)
      }
      await expect(drawer.getByRole('link', { name: 'Manage tags', exact: true }))
        .toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.screenshot({ path: info.outputPath(`admin-inspector-single-scroll-${width}.png`) })
      await drawer.getByRole('button', { name: 'Close', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Document settings', exact: true })).toBeFocused()
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

// The block toolbar stacks its actions under the side controls at every width,
// keeps both hit targets in view and closes on Escape.
for (const width of [320, 1440]) {
  test(`block actions form a vertical menu below horizontal side controls at ${width}px`, async ({ page }, info) => {
    const body = blockDocument(3)
    const api = await serveWorkspace(page, workspaceWith(body.meta.title, body))
    try {
      await openWorkspace(page, { title: body.meta.title, width })
      await reveal(page, 1)
      await expect(page.locator('.editor-side')).toHaveAttribute('data-orientation', 'horizontal')
      const addBox = await page.getByRole('button', { name: 'Add block', exact: true }).boundingBox()
      const menuBox = await page.getByRole('button', { name: 'Open block menu', exact: true }).boundingBox()
      if (addBox === null || menuBox === null) {
        throw new Error('The block toolbar must have two visible controls')
      }
      expect(Math.abs(addBox.y - menuBox.y)).toBeLessThanOrEqual(1)
      await page.getByRole('button', { name: 'Open block menu', exact: true }).click()
      const actions = page.locator('.editor-block-action-list')
      const remove = actions.getByRole('button', { name: 'Delete', exact: true })
      const colors = actions.getByRole('button', { name: 'Colors', exact: true })
      await expect(remove).toBeFocused()
      await expect(colors).toBeVisible()
      await withinViewport(page, blockActions(page))
      if (width >= 701) {
        await expect(blockActions(page)).toHaveCSS('opacity', '1')
      }
      await expect(actions.getByRole('button')).toHaveCount(2)
      const [removeBox, colorsBox] = await actions.getByRole('button').evaluateAll((elements) => {
        return elements.map((element) => {
          const box = element.getBoundingClientRect()
          return { x: box.x, y: box.y, width: box.width, height: box.height }
        })
      })
      if (removeBox === undefined || colorsBox === undefined) {
        throw new Error('Both block actions must have visible hit targets')
      }
      expect(Math.abs(removeBox.x - colorsBox.x)).toBeLessThanOrEqual(1)
      expect(Math.abs(removeBox.width - colorsBox.width)).toBeLessThanOrEqual(1)
      expect(colorsBox.y).toBeGreaterThanOrEqual(removeBox.y + removeBox.height)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.screenshot({ path: info.outputPath(`admin-vertical-block-actions-${width}.png`) })
      await page.keyboard.press('Escape')
      await expect(actions).toHaveCount(0)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}
