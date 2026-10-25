import { test as base, expect } from '@playwright/test'

export { expect }

// Intentionally plain: Playwright gives every test a fresh browser context and
// page, and the component harness has no Worker state to reset.
export const test = base
