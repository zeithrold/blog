import { test as base, expect } from '@playwright/test'

export { expect }

// Each case has a fresh native context/page, with no Worker state to reset.
// An uncaught error is never classified or excused by its message.
export const test = base.extend<{ browserErrors: undefined }>({
  browserErrors: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      await use(undefined)
      expect(errors).toEqual([])
    },
    { auto: true },
  ],
})
