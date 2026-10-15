import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { defineConfig } from '@playwright/test'

const port = Number(process.env.BLOG_DEV_TEST_PORT ?? 8822)
export default defineConfig({
  testDir: 'tests/development',
  timeout: 90000,
  workers: 1,
  use: {
    browserName: 'chromium',
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
  },
  outputDir: path.join(tmpdir(), 'blog-tests', 'development'),
  webServer: {
    command: `pnpm dev --port ${port}`,
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 60000,
  },
})
