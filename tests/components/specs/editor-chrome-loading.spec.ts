import type { Route } from '@playwright/test'
import { EDITOR_WORKSPACE_ROUTE } from '../support/editor-workspace-case'
import { editorWorkspaceApi, editorWorkspaceDocument } from '../support/editor-workspace-fixtures'
import { editorReady } from '../support/editor-workspace-ui'
import { defer, serveApi } from '../support/http-fixtures'
import { mountSurface } from '../support/mount'
import { expect, test } from '../support/test'

/**
 * The editor loading surface. The production entry is its own chunk here exactly
 * as it is in the application, so holding that one request is the real dynamic
 * import boundary rather than a replaced component.
 */

// The skeleton, its status and the reduced-motion contract are the fallback the
// entry's own Suspense boundary renders while its chunk is still in flight.
test('the editor loader displays a skeleton and spinner and respects reduced motion', async ({
  page,
  browserName,
}, info) => {
  const api = await serveApi(page, editorWorkspaceApi(editorWorkspaceDocument()))
  const gate = defer()
  const chunk = /\/assets\/editor-entry-[^/]+\.js(?:\?.*)?$/
  const hold = async (route: Route): Promise<void> => {
    await gate.promise
    await route.continue()
  }
  await page.route(chunk, hold)
  await page.setViewportSize({ width: 1440, height: 1000 })
  // WebKit holds the document here for as long as the chunk is unanswered, so the
  // mount is awaited only after the held request is released.
  const mounting = mountSurface(page, {
    surface: 'editor-workspace',
    route: EDITOR_WORKSPACE_ROUTE,
  })
  const loader = page.locator('.editor-loading')
  try {
    try {
      await expect(loader).toBeVisible()
      await expect(loader.getByRole('status')).toHaveText('Loading editor…')
      await expect(loader.locator('.editor-loading-skeleton').first()).toBeVisible()
      const spinner = loader.locator('.editor-loading-spinner')
      await expect(spinner).toHaveCSS('animation-name', 'spin')
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await expect(spinner).toHaveCSS('animation-name', 'none')
      await expect(loader.locator('.editor-loading-skeleton').first()).toHaveCSS('animation-name', 'none')
      if (browserName === 'chromium') {
        await page.screenshot({ path: info.outputPath('editor-loading-skeleton.png'), fullPage: true })
      }
    }
    finally {
      gate.open()
    }
    await mounting
    await editorReady(page)
    await expect(loader).toHaveCount(0)
    await api.expectServed()
  }
  finally {
    await page.unroute(chunk, hold)
    await api.dispose()
  }
})
