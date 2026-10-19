import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { acknowledgementSchema } from '@/contracts/documents'
import { sessionSchema } from '@/contracts/session'
import { fixture } from './fixtures'
import { focusPosition, instrumentation, samples } from './measurements'

type OpenFixture = {
  documentId: string
  bytes: number
  hash: string
  readyMs: number
  initializationMs: number
}

export async function openFixture(
  page: Page,
  count: number,
  bytes: number,
): Promise<OpenFixture> {
  await page.goto('/__fixture/login')
  const session = sessionSchema.parse(
    await (await page.request.get('/api/admin/session')).json(),
  )
  const write = writer(page, session.csrfToken)
  const created = await write('/api/admin/documents', {})
  const input = await fixture(count, bytes)
  await write(
    `/api/admin/documents/${created.documentId}/revisions`,
    {
      expectedVersion: created.version,
      baseRevisionId: created.headRevisionId,
      reason: 'manual',
      document: input.document,
    },
    'PUT',
  )
  await page.goto('/admin')
  const link = page.getByRole('link', { name: `Performance ${count}`, exact: true }).first()
  const started = Date.now()
  await link.click()
  await expect(page.getByLabel('Document body', { exact: true })).toBeVisible({
    timeout: 30000,
  })
  await page.waitForFunction(
    () => performance.getEntriesByName('cms-editor-ready').length > 0,
  )
  const readyMs = Date.now() - started
  const initializationMs = await page.evaluate(() => {
    const start = performance.getEntriesByName('cms-editor-start')[0]?.startTime
    const end = performance.getEntriesByName('cms-editor-ready')[0]?.startTime
    if (start === undefined || end === undefined) {
      throw new Error('Missing editor timing')
    }
    return end - start
  })
  return {
    documentId: created.documentId,
    bytes: input.bytes,
    hash: input.hash,
    readyMs,
    initializationMs,
  }
}
export async function typing(page: Page): Promise<number[]> {
  await instrumentation(page)
  for (let position = 0; position < 4; position++) {
    await focusPosition(page, position)
    await page.keyboard.type(`PERF_${position}_${'abcdefghijklmnopqrstuvwxy'.repeat(3)}`, {
      delay: 15,
    })
    for (let repeat = 0; repeat < 2; repeat++) {
      for (const key of [
        'ArrowLeft',
        'ArrowRight',
        'Shift+ArrowLeft',
        'Shift+ArrowRight',
        'ControlOrMeta+z',
        'ControlOrMeta+Shift+z',
      ]) {
        await page.keyboard.press(key)
      }
    }
  }
  await page.evaluate(
    async () =>
      await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      }),
  )
  return await samples(page, 'input')
}
export function percentile(values: number[], quantile: number): number {
  const sorted = values.toSorted((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)] ?? 0
}

function writer(
  page: Page,
  csrfToken: string,
): (
  path: string,
  body: unknown,
  method?: string,
) => Promise<ReturnType<typeof acknowledgementSchema.parse>> {
  const origin = new URL(page.url()).origin
  const write = async (
    path: string,
    body: unknown,
    method = 'POST',
  ): Promise<ReturnType<typeof acknowledgementSchema.parse>> => {
    const response = await page.request.fetch(path, {
      method,
      headers: {
        origin,
        'x-csrf-token': csrfToken,
        'idempotency-key': crypto.randomUUID(),
      },
      data: body,
    })
    expect(response.ok(), await response.text()).toBe(true)
    return acknowledgementSchema.parse(await response.json())
  }
  return write
}
