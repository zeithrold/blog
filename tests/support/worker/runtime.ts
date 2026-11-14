import type { DispatchFetch, RequestInit, V4MiniflareOptions, V4ModuleDefinition } from 'miniflare'
import type { MarkdownFixtureMode } from './notion-fixture'
import { rmSync } from 'node:fs'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { convertV4MiniflareOptions, Miniflare } from 'miniflare'
import { z } from 'zod'
import { NotionFixture, sourceId } from './notion-fixture'

export const webhookSecret = 'fixture-webhook-signing-secret'
export const subscriptionId = 'fixture-subscription'
const buildPath = fileURLToPath(new URL('../../../dist/server/wrangler.json', import.meta.url))
const builtConfigSchema = z.object({
  main: z.string(),
  compatibility_date: z.string(),
  compatibility_flags: z.array(z.string()),
  assets: z.object({ directory: z.string(), binding: z.literal('ASSETS') }),
  kv_namespaces: z.array(z.object({ binding: z.string() })),
})

async function builtConfig() {
  let text: string
  try {
    text = await readFile(buildPath, 'utf8')
  }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error('Built Worker missing: run pnpm build before integration/browser tests.', { cause: error })
    }
    throw error
  }
  const config = builtConfigSchema.safeParse(JSON.parse(text))
  if (!config.success || !config.data.kv_namespaces.some(value => value.binding === 'NOTION_CACHE')) {
    throw new Error('Built Worker is not the Notion migration build: run pnpm build first.')
  }
  return config.data
}

type WorkerFixture = {
  readonly origin: string
  readonly revise: () => void
  readonly unpublish: () => void
  readonly fetch: (path: string, init?: RequestInit) => ReturnType<DispatchFetch>
  readonly [Symbol.asyncDispose]: () => Promise<void>
}

async function startRuntime(options: V4MiniflareOptions, root: string): Promise<Miniflare> {
  let runtime: Miniflare | undefined
  try {
    runtime = new Miniflare(convertV4MiniflareOptions(options))
    await runtime.ready
    return runtime
  }
  catch (error) {
    try {
      await runtime?.dispose()
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
    throw error
  }
}

type WorkerFixtureOptions = {
  readonly port?: number
  readonly markdownMode?: MarkdownFixtureMode
  readonly additionalPostCount?: number
  readonly tagId?: string
}

export async function workerFixture(options: WorkerFixtureOptions = {}): Promise<WorkerFixture> {
  const config = await builtConfig()
  const directory = dirname(buildPath)
  const files = await readdir(directory, { recursive: true })
  const modules: V4ModuleDefinition[] = [
    { type: 'ESModule', path: resolve(directory, config.main) },
    ...files.filter(path => /\.m?js$/.test(path) && path !== config.main).map(path => ({
      type: 'ESModule' as const,
      path: resolve(directory, path),
    })),
  ]
  const fixture = new NotionFixture(options.markdownMode, options.additionalPostCount, options.tagId)
  const root = await mkdtemp(join(tmpdir(), 'notion-worker-'))
  const origin = options.port === undefined ? 'https://fixture.example' : `http://127.0.0.1:${options.port}`
  const runtime = await startRuntime({
    cf: false,
    host: '127.0.0.1',
    port: options.port ?? 0,
    modules,
    modulesRoot: directory,
    compatibilityDate: config.compatibility_date,
    compatibilityFlags: config.compatibility_flags,
    bindings: {
      PUBLIC_ORIGIN: origin,
      NOTION_API_KEY: 'fixture-notion-token',
      NOTION_DATA_SOURCE_ID: sourceId,
      NOTION_WEBHOOK_SECRET: webhookSecret,
      NOTION_WEBHOOK_SUBSCRIPTION_ID: subscriptionId,
    },
    kvNamespaces: ['NOTION_CACHE'],
    kvPersist: join(root, 'kv'),
    cachePersist: join(root, 'cache'),
    assets: {
      directory: resolve(directory, config.assets.directory),
      binding: 'ASSETS',
      run_worker_first: true,
      routerConfig: { has_user_worker: true },
    },
    outboundService: async request => await fixture.fetch(request),
  }, root)
  // Miniflare exits synchronously on signals, before async disposal can run.
  const onExit = () => rmSync(root, { recursive: true, force: true })
  process.once('exit', onExit)
  async function dispose() {
    try {
      await runtime.dispose()
    }
    finally {
      process.removeListener('exit', onExit)
      await rm(root, { recursive: true, force: true })
    }
  }
  return {
    origin,
    revise: () => fixture.revise(),
    unpublish: () => fixture.unpublish(),
    fetch: async (path, init) => await runtime.dispatchFetch(new URL(path, origin), init),
    [Symbol.asyncDispose]: dispose,
  }
}
