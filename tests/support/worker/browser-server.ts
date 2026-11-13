import process from 'node:process'
import { workerFixture } from './runtime'

async function main(): Promise<void> {
  const port = Number(process.env.BLOG_BROWSER_PORT ?? 8801)
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error('BLOG_BROWSER_PORT must be a valid TCP port')
  }
  // Miniflare owns process signals; the fixture also cleans state on exit.
  await workerFixture({ port })
  process.send?.('ready')
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
