import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { convertV4MiniflareOptions, Response as MFResponse, Miniflare } from 'miniflare'
import { unstable_getMiniflareWorkerOptions, unstable_splitSqlQuery } from 'wrangler'

export async function runtime(origin = 'http://127.0.0.1:8800', metadataFetch) {
  const { privateKey, publicKey } = await generateKeyPair('RS256')
  const jwk = {
    ...(await exportJWK(publicKey)),
    kid: 'test-key',
    alg: 'RS256',
    use: 'sig',
  }
  const team = 'blog-test.cloudflareaccess.com'
  const fixture = await makeFixture(origin, team, jwk, metadataFetch)
  await fixture.ready
  const db = await fixture.getD1Database('DB', 'blog-cms-local')
  await migrate(db)
  const jwt = signer(privateKey, team)
  const token = await jwt()
  async function fetch(url, init = {}) {
    return fixture.dispatchFetch(new URL(url, origin), {
      ...init,
      headers: { 'cf-access-jwt-assertion': token, ...init.headers },
    })
  }
  const session = await fetch('/api/admin/session')
  assert.equal(session.status, 200, await session.clone().text())
  const { csrfToken } = await session.json()
  async function write(url, body, method = 'POST', key = crypto.randomUUID()) {
    return fetch(url, {
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
    media: await fixture.getR2Bucket('MEDIA', 'blog-cms-local'),
    dispose: () => fixture.dispose(),
  }
}

async function makeFixture(origin, team, jwk, metadataFetch) {
  const options = unstable_getMiniflareWorkerOptions(
    path.resolve('dist/server/wrangler.json'),
  )
  const modulesRoot = path.resolve('dist/server')
  const modules = (await readdir(modulesRoot, { recursive: true }))
    .filter(file => file.endsWith('.js'))
    .sort((left, right) => Number(right === 'index.js') - Number(left === 'index.js'))
    .map(file => ({ type: 'ESModule', path: path.join(modulesRoot, file) }))
  return new Miniflare(
    convertV4MiniflareOptions({
      cf: false,
      workers: [
        {
          ...options.workerOptions,
          name: 'blog-cms-local',
          modules,
          modulesRules: undefined,
          modulesRoot,
          bindings: {
            ...options.workerOptions.bindings,
            PUBLIC_ORIGIN: origin,
            ACCESS_TEAM_DOMAIN: team,
            ACCESS_AUD: 'fixture-audience',
            OWNER_SUBS: '["fixture-owner"]',
            CSRF_SIGNING_SECRET: 'disposable-local-csrf-secret-at-least-32-characters',
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
            return new MFResponse(response.body, response)
          },
        },
        ...options.externalWorkers,
      ],
    }),
  )
}

async function migrate(db) {
  for (const file of (await readdir('migrations'))
    .filter(name => name.endsWith('.sql'))
    .sort()) {
    const migration = await readFile(path.join('migrations', file), 'utf8')
    await db.batch(unstable_splitSqlQuery(migration).map(sql => db.prepare(sql)))
  }
}

function signer(privateKey, team) {
  async function jwt(claims = {}) {
    return new SignJWT({ type: 'app', ...claims })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(claims.iss ?? `https://${team}`)
      .setAudience(claims.aud ?? 'fixture-audience')
      .setSubject(claims.sub ?? 'fixture-owner')
      .setIssuedAt()
      .setExpirationTime(claims.exp ?? '1h')
      .sign(privateKey)
  }
  return jwt
}
