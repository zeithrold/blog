import { test as base, expect } from '@playwright/test'

export { expect }

// The built Worker is shared by the serial runner, while each test owns its data and quotas.
export const test = base.extend<{ workerState: undefined }>({
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
