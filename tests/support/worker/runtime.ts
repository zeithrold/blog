import type { JWK, JWTPayload } from 'jose'
import type { DispatchFetch, V4FetchHandler } from 'miniflare'
import type { Environment } from '@/server/runtime/environment'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import {
  convertV4MiniflareOptions,
  Headers as MFHeaders,
  Response as MFResponse,
  Miniflare,
  V4WorkerOptionsSchema,
} from 'miniflare'
import { unstable_getMiniflareWorkerOptions, unstable_splitSqlQuery } from 'wrangler'
import { sessionSchema } from '@/contracts/session'
import { verifyBuildSource } from '~/tests/support/verification/build-source'

export type Runtime = {
  fixture: Miniflare
  db: Awaited<ReturnType<Miniflare['getD1Database']>>
  fetch: (url: string, init?: Parameters<DispatchFetch>[1]) => ReturnType<DispatchFetch>
  write: (url: string, body: unknown, method?: string, key?: string) => ReturnType<DispatchFetch>
  origin: string
  token: string
  jwt: ReturnType<typeof signer>
  csrfToken: string
  media: Environment['MEDIA']
  dispose: () => Promise<void>
}
type MetadataFetch = (request: Parameters<V4FetchHandler>[0]) => Response | Promise<Response>
type WorkerOptions = ReturnType<typeof V4WorkerOptionsSchema.parse>
type FixtureInputs = {
  modules: { type: 'ESModule', path: string }[]
  modulesRoot: string
  workerOptions: WorkerOptions
  externalWorkers: WorkerOptions[]
}
// `dist/server` is immutable for the life of a test run, so resolving wrangler's configuration
// and scanning the built modules is invariant work that must not repeat per case.
let fixtureInputs: Promise<FixtureInputs> | undefined
async function loadFixtureInputs(): Promise<FixtureInputs> {
  fixtureInputs ??= readFixtureInputs().catch((error: unknown) => {
    fixtureInputs = undefined
    throw error
  })
  return await fixtureInputs
}
async function readFixtureInputs(): Promise<FixtureInputs> {
  // The manifests describe the source that produced `dist`; they are checked before anything
  // resolves or evaluates a module from it, so a stale build cannot run under a newer checkout.
  verifyBuildSource()
  const options = unstable_getMiniflareWorkerOptions(
    path.resolve('dist/server/wrangler.json'),
  )
  const modulesRoot = path.resolve('dist/server')
  const modules = (await readdir(modulesRoot, { recursive: true }))
    .filter(file => file.endsWith('.js'))
    .sort((left, right) => Number(right === 'index.js') - Number(left === 'index.js'))
    .map(file => ({ type: 'ESModule' as const, path: path.join(modulesRoot, file) }))
  return {
    modules,
    modulesRoot,
    workerOptions: V4WorkerOptionsSchema.parse({ ...options.workerOptions, modules, modulesRoot }),
    externalWorkers: options.externalWorkers.map(worker => V4WorkerOptionsSchema.parse(worker)),
  }
}

export type RuntimeFailure = 'migrate' | 'ready'
export async function runtime(
  origin = 'http://127.0.0.1:8800',
  metadataFetch?: MetadataFetch,
  failure?: RuntimeFailure,
): Promise<Runtime> {
  const { privateKey, publicKey } = await generateKeyPair('RS256')
  const jwk = {
    ...(await exportJWK(publicKey)),
    kid: 'test-key',
    alg: 'RS256',
    use: 'sig',
  }
  const team = 'blog-test.cloudflareaccess.com'
  // Authentication material is per fixture, so a token minted for one case can never act in the next.
  const csrfSecret = `${crypto.randomUUID()}${crypto.randomUUID()}`
  const fixture = await makeFixture(origin, { team, jwk, csrfSecret }, metadataFetch)
  try {
    return await acquire(fixture, { origin, team, privateKey, failure })
  }
  catch (error) {
    // The caller never receives a Worker that failed after allocation, so it must be disposed here.
    await fixture.dispose().catch((disposeError: unknown) => console.error(disposeError))
    throw error
  }
}

async function acquire(
  fixture: Miniflare,
  options: { origin: string, team: string, privateKey: CryptoKey, failure?: RuntimeFailure },
): Promise<Runtime> {
  const { origin, team, privateKey, failure } = options
  await fixture.ready
  if (failure === 'ready') {
    throw new Error(`Injected fixture runtime failure (${failure})`)
  }
  const db = await fixture.getD1Database('DB', 'blog-cms-local')
  await migrate(db)
  if (failure === 'migrate') {
    throw new Error(`Injected fixture runtime failure (${failure})`)
  }
  const jwt = signer(privateKey, team)
  const token = await jwt()
  async function fetch(url: string, init: Parameters<DispatchFetch>[1] = {}) {
    return await fixture.dispatchFetch(new URL(url, origin), {
      ...init,
      headers: { 'cf-access-jwt-assertion': token, ...Object.fromEntries(new MFHeaders(init.headers)) },
    })
  }
  const session = await fetch('/api/admin/session')
  assert.equal(session.status, 200, await session.clone().text())
  const { csrfToken } = sessionSchema.parse(await session.json())
  async function write(url: string, body: unknown, method = 'POST', key: string = crypto.randomUUID()) {
    return await fetch(url, {
      method,
      headers: {
        'content-type': 'application/json',
        origin,
        'x-csrf-token': csrfToken,
        'idempotency-key': key,
      },
      body: JSON.stringify(body),
    })
  }
  return {
    fixture,
    db,
    fetch,
    write,
    origin,
    token,
    jwt,
    csrfToken,
    media: (await fixture.getBindings<Pick<Environment, 'MEDIA'>>('blog-cms-local')).MEDIA,
    dispose: async () => await fixture.dispose(),
  }
}

async function makeFixture(
  origin: string,
  identity: { team: string, jwk: JWK, csrfSecret: string },
  metadataFetch?: MetadataFetch,
) {
  const { modules, modulesRoot, workerOptions, externalWorkers } = await loadFixtureInputs()
  const { team, jwk, csrfSecret } = identity
  return new Miniflare(
    convertV4MiniflareOptions({
      cf: false,
      workers: [
        {
          ...workerOptions,
          name: 'blog-cms-local',
          modules,
          modulesRules: undefined,
          modulesRoot,
          bindings: {
            ...workerOptions.bindings,
            PUBLIC_ORIGIN: origin,
            ACCESS_TEAM_DOMAIN: team,
            ACCESS_AUD: 'fixture-audience',
            OWNER_SUBS: '["fixture-owner"]',
            CSRF_SIGNING_SECRET: csrfSecret,
          },
          outboundService: async (request) => {
            if (request.url === `https://${team}/cdn-cgi/access/certs`) {
              return MFResponse.json({ keys: [jwk] })
            }
            assert.ok(['api.crossref.org', 'api.datacite.org'].includes(new URL(request.url).hostname))
            const response = metadataFetch !== undefined
              ? await metadataFetch(request)
              : await fetch(request.url, {
                  headers: Object.fromEntries(request.headers),
                  redirect: 'manual',
                  signal: AbortSignal.timeout(8000),
                })
            return new MFResponse(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers: Object.fromEntries(response.headers),
            })
          },
        },
        ...externalWorkers,
      ],
    }),
  )
}

async function migrate(db: Runtime['db']) {
  for (const file of (await readdir('migrations'))
    .filter(name => name.endsWith('.sql'))
    .sort()) {
    const migration = await readFile(path.join('migrations', file), 'utf8')
    await db.batch(unstable_splitSqlQuery(migration).map(sql => db.prepare(sql)))
  }
}

function signer(privateKey: CryptoKey, team: string) {
  async function jwt(
    claims: Pick<JWTPayload, 'iss' | 'aud' | 'sub'> & Record<string, unknown> & { exp?: number | string } = {},
  ) {
    const { exp, ...payload } = claims
    return await new SignJWT({ type: 'app', ...payload })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(claims.iss ?? `https://${team}`)
      .setAudience(claims.aud ?? 'fixture-audience')
      .setSubject(claims.sub ?? 'fixture-owner')
      .setIssuedAt()
      .setExpirationTime(exp ?? '1h')
      .sign(privateKey)
  }
  return jwt
}
