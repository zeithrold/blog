import path from 'node:path'
import { defineConfig } from 'vitest/config'

/*
 * The harness contract suite: the layer's own jsdom host and its own `afterEach`,
 * run against fixtures that are supposed to fail.
 *
 * This is not business proof and not a second DOM layer. It exists because a
 * teardown guarantee cannot be proved by a Node probe calling a helper: the claim
 * is "this case fails in a real Vitest lifecycle", so a real Vitest run has to
 * produce the failure. `pnpm test:ci-plan` runs each fixture in its own process
 * (`tests/ci/dom-harness.test.ts`) and asserts the verdict and the reason.
 *
 * The fixtures live outside `tests/dom`, so the official `test:dom` layer never
 * collects them and a deliberately failing fixture cannot turn the layer red.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/harness/dom/**/*.test.tsx'],
    // The same setup file the DOM layer uses: the boundary under test is the real one.
    setupFiles: [
      path.join(import.meta.dirname, 'tests/dom/setup.ts'),
    ],
    reporters: ['default'],
  },
})
