import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.BLOG_BROWSER_PORT ?? 8801)
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests/browser',
  forbidOnly: true,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  outputDir: 'test-results',
  use: {
    baseURL,
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'exec node --import tsx tests/support/worker/browser-server.ts',
    url: `${baseURL}/api/health`,
    env: { BLOG_BROWSER_PORT: String(port) },
    reuseExistingServer: false,
    timeout: 60_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
  },
})
