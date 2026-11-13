import assert from 'node:assert/strict'
import { fork } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

async function availablePort(): Promise<number> {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert.ok(address !== null && typeof address === 'object')
  const port = address.port
  await new Promise<void>((resolve, reject) => {
    server.close(error => error === undefined ? resolve() : reject(error))
  })
  return port
}

test('browser host removes temporary KV state when Miniflare handles SIGTERM', { timeout: 15_000 }, async (t) => {
  const port = await availablePort()
  const root = await mkdtemp(join(tmpdir(), 'notion-host-lifecycle-'))
  const child = fork(fileURLToPath(new URL('../support/worker/browser-server.ts', import.meta.url)), {
    execArgv: ['--import', 'tsx'],
    env: { ...process.env, TMPDIR: root, BLOG_BROWSER_PORT: String(port) },
    stdio: [
      'ignore',
      'ignore',
      'inherit',
      'ipc',
    ],
  })
  const exited = once(child, 'exit')
  t.after(async () => {
    child.kill('SIGKILL')
    try {
      await exited
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
  await once(child, 'message', { signal: t.signal })
  const state = (await readdir(root)).filter(name => name.startsWith('notion-worker-'))
  assert.equal(state.length, 1, 'The host must acquire its own state before shutdown')
  child.kill('SIGTERM')
  await exited
  // tsx owns a separate transpiler cache; this test owns and removes the outer root.
  const remaining = (await readdir(root)).filter(name => state.includes(name))
  assert.equal(remaining.length, 0, JSON.stringify(remaining))
}).catch((error: unknown) => {
  throw new Error('Host lifecycle test registration failed', { cause: error })
})
