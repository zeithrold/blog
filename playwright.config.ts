import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { defineConfig } from '@playwright/test'
import { verificationArtifacts } from '@ztd-me/frontend-checks/playwright'

const testPort = Number(process.env.BLOG_TEST_PORT ?? 8801)
const artifacts = verificationArtifacts(path.join(tmpdir(), 'blog-tests', 'browser'))
export default defineConfig({
  ...artifacts,
  timeout: 60000,
  workers: 1,
  use: {
    ...artifacts.use,
    baseURL: `http://127.0.0.1:${testPort}`,
    viewport: { width: 1440, height: 1000 },
  },
  projects: [
    { name: 'chromium', testDir: 'tests/browser', use: { browserName: 'chromium' } },
    { name: 'webkit', testDir: 'tests/browser', use: { browserName: 'webkit' } },
    {
      name: 'performance',
      testDir: 'tests/performance',
      timeout: 120000,
      // DOM snapshots and video recording distort CPU-throttled latency measurements.
      use: { browserName: 'chromium', trace: 'off', video: 'off' },
    },
  ],
  webServer: {
    command: 'node --import tsx tests/support/worker/browser-server.ts',
    url: `http://127.0.0.1:${testPort}/api/health`,
    reuseExistingServer: false,
    timeout: 30000,
  },
})
