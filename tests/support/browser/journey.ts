import type { BrowserContext, Locator, Page, TestInfo } from '@playwright/test'
import type { CaptureProof } from './journey-capture'
import type { MediaCloneProof } from './journey-requests'
import type { Document } from '@/content/document'
import type { OpenDocument } from '@/contracts/documents'
import { openDocumentSchema } from '@/contracts/documents'
import { saved } from './document'
import { captureEvidence, consumeScreenshotError } from './journey-capture'
import { assertPageLayout, assertTypography, assertUsable, expectReleased, settle } from './journey-layout'
import { consumeDragCancellation } from './journey-requests'
import { draftPreview } from './preview'
import { test as base, expect } from './test'

type Observation = { page: string, url: string, at: number, message: string, method?: string }
type ExpectedFailure = { path: string, status: number, method: string, hits: number, active: boolean }
type Journey = {
  failures: ExpectedFailure[]
  checkpoints: { name: string, url: string, at: number }[]
  pageIds: WeakMap<Page, string>
  captures: CaptureProof[]
  drags: MediaCloneProof[]
}
export type JourneyContext = { page: Page, context: BrowserContext, journey: Journey }

// The fixture resets once per journey, never between test.step stages.
export const test = base.extend<{ journey: Journey }>({
  journey: [
    async ({ context }, run, info) => {
      const state: Journey = { failures: [], checkpoints: [], pageIds: new WeakMap(), captures: [], drags: [] }
      const errors: Observation[] = []
      const rejected: Observation[] = []
      const expectedResources: Observation[] = []
      observe(context, state, { errors, rejected, expectedResources })
      try {
        await run(state)
      }
      finally {
        const requests = rejected.map(error => ({ ...error, dragClone: consumeDragCancellation(error, state.drags) }))
        const unresolved = requests.filter(error => !error.dragClone)
        const unexpected = errors.filter(error => !consumeScreenshotError(error, state.captures)
          && !expectedResources.some(resource =>
            resource.page === error.page && Math.abs(resource.at - error.at) < 1000
            && (error.url === resource.url
              || (error.url === '' && error.message.startsWith('Failed to load resource:')))))
        await info.attach('journey.json', {
          body: JSON.stringify({
            project: info.project.name,
            title: info.title,
            checkpoints: state.checkpoints,
            failures: state.failures,
            errors: unexpected,
            rejected: unresolved,
            requestFailures: requests,
            captures: state.captures,
            drags: state.drags,
          }, null, 2),
          contentType: 'application/json',
        })
        expect(unexpected, 'Unexpected browser errors during the journey').toEqual([])
        expect(unresolved, 'Unexpected failed requests during the journey').toEqual([])
        for (const failure of state.failures) {
          expect(failure.hits, `Fault was exercised: ${failure.method} ${failure.path}`).toBeGreaterThan(0)
        }
      }
    },
    { auto: true },
  ],
})
export { expect }

test.use({ actionTimeout: 15000 })

function observe(
  context: BrowserContext,
  journey: Journey,
  observations: { errors: Observation[], rejected: Observation[], expectedResources: Observation[] },
): void {
  const { errors, rejected, expectedResources } = observations
  const watch = (page: Page): void => {
    const pageId = crypto.randomUUID()
    journey.pageIds.set(page, pageId)
    const record = (url: string, message: string): Observation => ({
      page: pageId,
      url,
      message,
      at: Date.now(),
    })
    page.on('pageerror', error => errors.push(record('', error.message)))
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(record(message.location().url, message.text()))
      }
    })
    page.on('response', (response) => {
      if (response.status() < 400) {
        return
      }
      const matching = journey.failures.find(failure => failure.active
        && failure.path === new URL(response.url()).pathname
        && failure.method === response.request().method() && failure.status === response.status())
      const entry = record(response.url(), `HTTP ${response.status()}`)
      if (matching !== undefined) {
        matching.hits++
        expectedResources.push(entry)
      }
      else {
        rejected.push(entry)
      }
    })
    page.on('requestfailed', (request) => {
      // Navigating away legitimately aborts RSC requests; mutations must never be silently ignored.
      const asset = /^\/api\/admin\/assets\//u.test(new URL(request.url()).pathname)
      if (!asset && request.method() === 'GET' && request.failure()?.errorText.includes('ERR_ABORTED') === true) {
        return
      }
      rejected.push({
        ...record(request.url(), request.failure()?.errorText ?? 'Request failed'),
        method: request.method(),
      })
    })
  }
  context.pages().forEach(watch)
  context.on('page', watch)
}

export async function opened(page: Page, id: string): Promise<OpenDocument> {
  const response = await page.request.get(`/api/admin/documents/${id}`)
  expect(response.status()).toBe(200)
  return openDocumentSchema.parse(await response.json())
}

export async function semanticCheckpoint(
  page: Page,
  info: TestInfo,
  journey: Journey,
  checkpoint: { name: string, id: string, expected: Document },
): Promise<void> {
  const { name, id, expected } = checkpoint
  await saved(page)
  const actual = await opened(page, id)
  await info.attach(`${name}-document.json`, {
    body: JSON.stringify({ expected, actual }, null, 2),
    contentType: 'application/json',
  })
  expect(actual.document, name).toEqual(expected)
  await layoutCheckpoint(page, info, journey, name)
}

export async function layoutCheckpoint(
  page: Page,
  info: TestInfo,
  journey: Journey,
  name: string,
): Promise<void> {
  await settle(page)
  await assertPageLayout(page)
  for (const body of await page.locator('.bn-editor:visible').all()) {
    await assertTypography(body)
  }
  for (const body of await page.locator('.reader-body:visible').all()) {
    await assertTypography(body)
  }
  journey.checkpoints.push({ name, url: page.url(), at: Date.now() })
  await captureEvidence(page, info, { name, pageId: journey.pageIds.get(page) ?? '', proofs: journey.captures })
}

export async function previewCheckpoint(page: Page, text: string): Promise<Locator> {
  const preview = await draftPreview(page)
  await expect(preview.getByRole('region', { name: 'Draft reader preview', exact: true })).toContainText(text)
  const close = preview.getByRole('button', { name: 'Close preview', exact: true })
  await assertUsable(close, 44)
  await assertTypography(preview.locator('.reader-body'))
  await close.click()
  await expect(preview).toHaveCount(0)
  await expectReleased(page, page.getByRole('button', { name: 'More document actions', exact: true }))
  return preview
}

export async function documentAction(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'More document actions', exact: true }).click()
  const menu = page.locator('.document-action-menu[role="menu"]')
  const drawer = page.locator('.document-actions-drawer[role="dialog"]')
  await expect(menu.or(drawer)).toBeVisible()
  if (await drawer.isVisible()) {
    await drawer.getByRole('button', { name, exact: true }).or(drawer.getByRole('link', { name, exact: true })).click()
  }
  else {
    await menu.getByRole('menuitem', { name, exact: true }).click()
  }
}

export async function navigation(page: Page, name: string, wait = true): Promise<void> {
  const link = page.getByRole('link', { name, exact: true })
  if (await link.isVisible()) {
    await link.click()
  }
  else {
    await page.locator('.workspace-navigation-mobile').click()
    await page.getByRole('menuitem', { name, exact: true }).click()
  }
  if (wait) {
    const heading = name === 'Media library' ? 'Gallery' : name
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
  }
}

export async function closeInspector(page: Page): Promise<void> {
  const drawer = page.getByRole('dialog', { name: 'Document settings', exact: true })
  if (await drawer.isVisible()) {
    await drawer.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(drawer).toHaveCount(0)
  }
}
