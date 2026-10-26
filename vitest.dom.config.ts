import { randomUUID } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import { defineConfig } from 'vitest/config'
import { domArtifactRoot } from './tests/support/verification/paths.ts'

/*
 * The `dom` layer: one jsdom harness for behavior that needs a real document and
 * the real React client but not an engine, a Worker, a route or hydration.
 *
 * It is a native layer of `pnpm check:base`, next to unit and integration, and it
 * joins their prepared batch: the script never prepares a run of its own, so one
 * `test:prepare` still owns source and run id for every layer of the batch. Cases
 * are recorded as `layer: 'dom'` with no Playwright project — a jsdom case is
 * never reported as chromium or webkit, and its evidence cannot stand in for a
 * browser layer.
 *
 * This invocation is named once, here, so Vitest's own JSON report and the
 * receipt that binds it to the layer proof cannot drift apart or overwrite an
 * earlier attempt.
 */
const invocation = randomUUID()
const nativeReport = path.join(domArtifactRoot, `${invocation}-vitest.json`)
process.env.BLOG_DOM_INVOCATION = invocation
process.env.BLOG_DOM_NATIVE_REPORT = nativeReport

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: [
      {
        // The narrowest stand-in the shared jsdom harness needs: the app's page
        // components import `next/link`, and Vitest cannot transform that specifier.
        // This renders host anchor markup; it proves no Next routing, no server
        // render and no navigation. Those stay in the browser layers.
        find: 'next/link',
        replacement: path.join(import.meta.dirname, 'tests/components/src/adapters/next-link.tsx'),
      },
      {
        // Header guards read the host URL; this adapter does not establish Next
        // navigation, popstate repair or hydration behavior.
        find: 'next/navigation',
        replacement: path.join(import.meta.dirname, 'tests/components/src/adapters/next-navigation.ts'),
      },
    ],
  },
  test: {
    environment: 'jsdom',
    include: ['tests/dom/**/*.test.tsx'],
    setupFiles: ['tests/dom/setup.ts'],
    reporters: [
      'default',
      // Vitest's own report, retained per invocation and cross-checked by the receipt.
      [
        'json',
        { outputFile: nativeReport },
      ],
      './tests/support/verification/dom-reporter.ts',
    ],
  },
})
