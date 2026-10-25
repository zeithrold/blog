import type { Page } from '@playwright/test'
import { test as base, expect } from '@playwright/test'

export { expect }

// The built Worker is shared by the serial runner, while each test owns its data and quotas.
export const test = base.extend<{ workerState: undefined, highlighterDiagnostics: undefined }>({
  highlighterDiagnostics: [
    async ({ context }, run, info) => {
      const records: { url: string, message: string }[] = []
      const observe = (page: Page): void => {
        page.on('console', (message) => {
          if (message.text().startsWith('[blog-shiki-diagnostic]')) {
            records.push({ url: page.url(), message: message.text() })
          }
        })
      }
      context.pages().forEach(observe)
      context.on('page', observe)
      try {
        await run(undefined)
      }
      finally {
        context.off('page', observe)
        if (records.length > 0) {
          await info.attach('shiki-diagnostics.json', {
            body: JSON.stringify(records, null, 2),
            contentType: 'application/json',
          })
        }
      }
    },
    { auto: true },
  ],
  workerState: [
    async ({ request }, use, info) => {
      // The gateway names the project so CPU-throttled performance runs keep every build
      // synchronous instead of sharing the machine with a background one.
      const reset = await request.post(`/__fixture/reset?project=${encodeURIComponent(info.project.name)}`)
      expect(reset.status(), await reset.text()).toBe(204)
      await use(undefined)
    },
    { auto: true },
  ],
})
