import type { Buffer } from 'node:buffer'
import type { ChildProcess } from 'node:child_process'
import { execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { promisify } from 'node:util'
import { z } from 'zod'
import { operationsSchema } from '@/contracts/operations'
import { sessionSchema } from '@/contracts/session'
import { equal } from '~/tests/support/unit/assertions'
import { json } from './responses'

// The per-case gateway from `browser-server.ts`, addressed exactly as the Playwright runner
// addresses it. A test picks the port it wants; the helper picks a free one by default.
export type Gateway = { child: ChildProcess, origin: string, output: () => string }
export type StartOptions = { port?: number, env?: Record<string, string> }
export type Call = {
  method?: string
  body?: BodyInit
  headers?: Record<string, string>
  signal?: AbortSignal
  anonymous?: boolean
}
export type Write = (path: string, body: unknown, method?: string, key?: string) => Promise<Response>
export type Health = z.infer<typeof operationsSchema>
export type SearchResult = z.infer<typeof searchResults>
const run = promisify(execFile)
const started = new Set<ChildProcess>()
const owner = { cookie: 'fixture=browser-test' }
const identity = z.strictObject({
  fixture: z.literal('browser-server'),
  pid: z.number().int().positive(),
  port: z.number().int().positive(),
  reading: z.number().int().nonnegative(),
  generation: z.number().int().positive(),
})
type GatewayState = z.infer<typeof identity>
export type { GatewayState }
const searchResults = z.object({
  items: z.array(z.object({ title: z.string(), path: z.string() })),
  nextOffset: z.number().int().nullable(),
})

export async function start(options: StartOptions = {}): Promise<Gateway> {
  assertBuilt()
  const port = options.port ?? await freePort()
  const origin = `http://127.0.0.1:${port}`
  const chunks: string[] = []
  const child = spawn(
    process.execPath,
    [
      '--import',
      'tsx',
      'tests/support/worker/browser-server.ts',
    ],
    {
      env: { ...process.env, ...options.env, BLOG_TEST_PORT: String(port), BLOG_TEST_RUN_ID: 'runtime-opt' },
      stdio: [
        'ignore',
        'pipe',
        'pipe',
      ],
    },
  )
  started.add(child)
  const record = (chunk: Buffer) => {
    chunks.push(String(chunk))
    if (chunks.length > 200) {
      chunks.splice(0, chunks.length - 200)
    }
  }
  child.stdout.on('data', record)
  child.stderr.on('data', record)
  const gateway = { child, origin, output: () => chunks.join('') }
  try {
    await waitForIdentity(gateway, port)
    return gateway
  }
  catch (error) {
    // A failed start must not leave its child (or its Workers) behind.
    await kill(child).catch(() => undefined)
    started.delete(child)
    throw error
  }
}

export async function stop(gateway: Gateway): Promise<number> {
  const pid = gateway.child.pid
  const workers = pid === undefined ? [] : await children(pid)
  const exited = await kill(gateway.child)
  if (!exited) {
    throw new Error(`fixture gateway did not exit\n${gateway.output()}`)
  }
  started.delete(gateway.child)
  // Every Worker runtime the gateway started must be gone, including a warm spare.
  await Promise.all(workers.map(async worker => await waitForGone(worker)))
  return gateway.child.exitCode ?? 0
}

// Runs one scenario against its own gateway and requires a clean shutdown afterwards.
export async function withGateway<T>(
  options: StartOptions,
  scenario: (gateway: Gateway) => Promise<T>,
): Promise<T> {
  const gateway = await start(options)
  try {
    const result = await scenario(gateway)
    equal(await stop(gateway), 0, `fixture gateway did not exit 0\n${gateway.output()}`)
    return result
  }
  catch (error) {
    await stop(gateway).catch(() => undefined)
    throw error
  }
}

// Safety net for scenarios that fail before they reach their own shutdown step.
export async function cleanupGateways(): Promise<void> {
  const pending = [
    ...started,
  ]
  await Promise.all(pending.map(async (child) => {
    started.delete(child)
    await kill(child, 5000)
  }))
}

export async function waitForChildren(pid: number, expected: number): Promise<void> {
  for (let attempt = 0; attempt < 400; attempt++) {
    const workers = await children(pid)
    if (workers.length === expected) {
      return
    }
    await delay(50)
  }
  throw new Error(`expected ${expected} fixture runtimes, found ${(await children(pid)).length}`)
}

// The state the gateway reports about the case it is serving, for scenarios that must wait for it.
export async function gatewayState(origin: string): Promise<GatewayState | undefined> {
  const response = await fetch(`${origin}/__fixture/health`).catch(() => undefined)
  if (response?.ok !== true) {
    return undefined
  }
  const parsed = identity.safeParse(await response.json())
  return parsed.success ? parsed.data : undefined
}

export async function call(origin: string, path: string, init: Call = {}): Promise<Response> {
  const { anonymous = false, headers, ...rest } = init
  return await fetch(new URL(path, origin), {
    ...rest,
    redirect: 'manual',
    headers: { ...(anonymous ? {} : owner), ...headers },
  })
}

export async function status(response: Response): Promise<number> {
  await response.arrayBuffer()
  return response.status
}

export async function session(origin: string): Promise<string> {
  const body = await json(await call(origin, '/api/admin/session'), 200, sessionSchema)
  return body.csrfToken
}

export function writer(origin: string, csrfToken: string): Write {
  return async (path, body, method = 'POST', key = crypto.randomUUID()) =>
    await call(origin, path, {
      method,
      headers: {
        'content-type': 'application/json',
        'origin': origin,
        'x-csrf-token': csrfToken,
        'idempotency-key': key,
      },
      body: JSON.stringify(body),
    })
}

export async function health(origin: string): Promise<Health> {
  return await json(await call(origin, '/api/admin/operations'), 200, operationsSchema)
}

export async function search(origin: string, query: string): Promise<SearchResult> {
  return await json(
    await call(origin, `/api/search?q=${encodeURIComponent(query)}`),
    200,
    searchResults,
  )
}

export async function postReset(
  origin: string,
  project: string,
): Promise<{ status: number, body: string, elapsed: number }> {
  const startedAt = performance.now()
  const response = await fetch(`${origin}/__fixture/reset?project=${project}`, { method: 'POST' })
  const body = await response.text()
  return {
    status: response.status,
    body,
    elapsed: performance.now() - startedAt,
  }
}

export async function reset(origin: string, project: string): Promise<number> {
  const result = await postReset(origin, project)
  equal(result.status, 204, result.body)
  return result.elapsed
}

async function waitForIdentity(gateway: Gateway, port: number): Promise<void> {
  for (let attempt = 0; attempt < 900; attempt++) {
    if (gateway.child.exitCode !== null) {
      throw new Error(`fixture gateway exited early (${gateway.child.exitCode})\n${gateway.output()}`)
    }
    const response = await fetch(`${gateway.origin}/__fixture/health`).catch(() => undefined)
    if (response !== undefined && response.ok) {
      const body: unknown = await response.json().catch(() => undefined)
      const parsed = identity.safeParse(body)
      if (parsed.success && parsed.data.pid === gateway.child.pid && parsed.data.port === port) {
        return
      }
      // Anything else on this port is a different server and must never be used as the fixture.
      throw new Error(`another server answered on ${gateway.origin}: ${JSON.stringify(body)}`)
    }
    await delay(100)
  }
  throw new Error(`fixture gateway did not identify itself on ${gateway.origin}\n${gateway.output()}`)
}

async function freePort(): Promise<number> {
  const server = createServer()
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => resolve())
    })
    const address = server.address()
    if (typeof address !== 'object' || address === null) {
      throw new Error('unable to reserve a fixture port')
    }
    return address.port
  }
  finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve())
    })
  }
}

function assertBuilt(): void {
  if (!existsSync('dist/server/wrangler.json')) {
    throw new Error('build the Worker with `pnpm build` before running the integration suite')
  }
}

async function kill(child: ChildProcess, timeout = 15000): Promise<boolean> {
  if (child.exitCode !== null) {
    return true
  }
  const exited = new Promise<boolean>((resolve) => {
    child.once('exit', () => resolve(true))
  })
  child.kill('SIGTERM')
  if (await Promise.race([
    exited,
    delay(timeout).then(() => false),
  ])) {
    return true
  }
  child.kill('SIGKILL')
  return await Promise.race([
    exited,
    delay(5000).then(() => false),
  ])
}

// The Worker processes the gateway currently runs, for scenarios that have to reach one directly.
export async function children(pid: number): Promise<number[]> {
  try {
    const { stdout } = await run('pgrep', [
      '-P',
      String(pid),
    ])
    return stdout
      .split('\n')
      .map(line => Number(line.trim()))
      .filter(child => Number.isSafeInteger(child) && child > 0)
  }
  catch (error) {
    // pgrep reports exit status 1 when the process has no children.
    if (isExitCode(error, 1)) {
      return []
    }
    throw error
  }
}

function isExitCode(error: unknown, code: number): boolean {
  return error instanceof Error && 'code' in error && error.code === code
}

async function waitForGone(pid: number): Promise<void> {
  for (let attempt = 0; attempt < 400; attempt++) {
    if (!alive(pid)) {
      return
    }
    await delay(50)
  }
  throw new Error(`fixture runtime ${pid} survived gateway shutdown`)
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  }
  catch {
    return false
  }
}
