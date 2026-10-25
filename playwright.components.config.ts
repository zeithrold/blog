import type { ReporterDescription } from '@playwright/test'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { defineConfig } from '@playwright/test'
import { verificationArtifacts } from '@ztd-me/frontend-checks/playwright'

const port = Number(process.env.BLOG_COMPONENT_TEST_PORT ?? 8830)
const runId = process.env.BLOG_COMPONENT_TEST_RUN_ID
  ?? process.env.BLOG_TEST_RUN_ID
  ?? `components-${Date.now()}`
const artifacts = verificationArtifacts(path.join(
  tmpdir(),
  'blog-tests',
  runId,
  'components',
))
const reporters: ReporterDescription[] = typeof artifacts.reporter === 'string'
  ? [
      [artifacts.reporter],
    ]
  : artifacts.reporter ?? []
const webServerCommand = 'vite build --config tests/components/vite.config.ts'
  + ' && vite preview --config tests/components/vite.config.ts'

export default defineConfig({
  ...artifacts,
  reporter: reporters,
  testDir: 'tests/components/specs',
  timeout: 30000,
  workers: 1,
  use: {
    ...artifacts.use,
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1440, height: 1000 },
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: webServerCommand,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      BLOG_COMPONENT_TEST_PORT: String(port),
      BLOG_COMPONENT_TEST_RUN_ID: runId,
    },
  },
})
