import type { Page } from '@playwright/test'
import type { Buffer } from 'node:buffer'
import { expect } from '@playwright/test'

export async function interruptTransfer(
  page: Page,
  outcome: 'committed' | 'disconnected' | 'csrf-renewal',
  payload: Buffer,
): Promise<{
  allocations: string[]
  transfers: string[]
}> {
  const allocations: string[] = []
  const transfers: string[] = []
  await page.route('**/api/admin/assets', async (route) => {
    if (route.request().method() === 'POST') {
      allocations.push(route.request().headers()['idempotency-key'] ?? '')
    }
    await route.continue()
  })
  await page.route('**/api/admin/assets/*/content', async (route) => {
    if (route.request().method() !== 'PUT') {
      await route.continue()
      return
    }
    transfers.push(route.request().url())
    if (transfers.length === 1) {
      if (outcome === 'committed') {
        // WebKit does not expose File request bodies to route.fetch; send the same fixture bytes explicitly.
        const response = await route.fetch({ postData: payload })
        expect(response.ok(), await response.text()).toBe(true)
      }
      await route.abort('failed')
    }
    else if (outcome === 'csrf-renewal' && transfers.length === 2) {
      await route.fulfill({ status: 403, json: { code: 'CSRF_INVALID' } })
    }
    else {
      await route.continue()
    }
  })
  if (outcome === 'committed') {
    await page.route('**/api/admin/assets/*', async (route) => {
      await route.fulfill({ status: 503, json: { code: 'CONNECTION_FAILED' } })
    }, { times: 1 })
  }
  return { allocations, transfers }
}
