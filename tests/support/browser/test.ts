import { test as base, expect } from '@playwright/test'

export { expect }

// The built Worker is shared by the serial runner, while each test owns its data and quotas.
export const test = base.extend<{ workerState: undefined }>({
  workerState: [
    async ({ request }, use) => {
      const reset = await request.post('/__fixture/reset')
      expect(reset.status(), await reset.text()).toBe(204)
      await use(undefined)
    },
    { auto: true },
  ],
})
