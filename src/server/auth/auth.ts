import type { Environment } from '@/server/runtime/environment'
import { jwtVerify, SignJWT } from 'jose'
import { accessKeyset } from '@/server/auth/access-keyset'
import { Problem } from '@/server/http/problem'

const keysets = new Map<string, ReturnType<typeof accessKeyset>>()
export function trustedOrigin(env: Environment): URL {
  try {
    const origin = new URL(env.PUBLIC_ORIGIN)
    if (
      origin.origin !== env.PUBLIC_ORIGIN
      || !['https:', 'http:'].includes(origin.protocol)
      || origin.username !== ''
      || origin.password !== ''
    ) {
      throw new Error('Invalid authentication configuration or claims')
    }
    if (
      origin.protocol === 'http:'
      && !['127.0.0.1', 'localhost'].includes(origin.hostname)
    ) {
      throw new Error('Invalid authentication configuration or claims')
    }
    return origin
  }
  catch {
    throw new Problem(503, 'AUTH_NOT_CONFIGURED')
  }
}
export async function requireAdmin(headers: Headers, env: Environment): Promise<string> {
  const { issuer, audience } = accessConfiguration(env)
  const token = headers.get('cf-access-jwt-assertion')
  if (token === null || token === '') {
    throw new Problem(401, 'AUTH_REQUIRED')
  }
  if (token.length > 16384) {
    throw new Problem(401, 'AUTH_INVALID')
  }
  // The configured Access application's policy owns admission. Keep the subject
  // for audit records and identity-bound CSRF/session state, not a second allowlist.
  return await verifyAccessToken(token, issuer, audience)
}
function accessConfiguration(env: Environment): {
  issuer: string
  audience: string
} {
  const team = env.ACCESS_TEAM_DOMAIN
  if (
    !(team !== undefined && team !== '')
    || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(team)
    || !(env.ACCESS_AUD !== undefined && env.ACCESS_AUD !== '')
  ) {
    throw new Problem(503, 'AUTH_NOT_CONFIGURED')
  }
  return { issuer: `https://${team}`, audience: env.ACCESS_AUD }
}
async function verifyAccessToken(
  token: string,
  issuer: string,
  audience: string,
): Promise<string> {
  let keys = keysets.get(issuer)
  if (!(keys !== undefined)) {
    if (keysets.size >= 4) {
      keysets.clear()
    }
    keys = accessKeyset(issuer)
    keysets.set(issuer, keys)
  }
  let sub: string
  try {
    const { payload } = await jwtVerify(token, keys, {
      algorithms: ['RS256'],
      issuer,
      audience,
      requiredClaims: [
        'exp',
        'iat',
        'sub',
        'iss',
        'aud',
      ],
      clockTolerance: 5,
    })
    if (
      payload.type !== 'app'
      || !(payload.sub !== undefined && payload.sub !== '')
      || typeof payload.iat !== 'number'
      || payload.iat > Date.now() / 1000 + 5
    ) {
      throw new Error('Invalid authentication configuration or claims')
    }
    sub = payload.sub
  }
  catch {
    throw new Problem(401, 'AUTH_INVALID')
  }
  return sub
}

function secret(env: Environment): Uint8Array {
  if (
    !(env.CSRF_SIGNING_SECRET !== undefined && env.CSRF_SIGNING_SECRET !== '')
    || env.CSRF_SIGNING_SECRET.length < 32
  ) {
    throw new Problem(503, 'AUTH_NOT_CONFIGURED')
  }
  return new TextEncoder().encode(env.CSRF_SIGNING_SECRET)
}
export async function sessionToken(
  sub: string,
  origin: string,
  env: Environment,
): Promise<string> {
  return await new SignJWT({
    origin,
  })
    .setProtectedHeader({
      alg: 'HS256',
      typ: 'JWT',
    })
    .setSubject(sub)
    .setIssuer('blog-cms:csrf')
    .setAudience('blog-cms:mutation')
    .setIssuedAt()
    .setExpirationTime('30m')
    .sign(secret(env))
}
export async function requireMutation(
  request: Request,
  sub: string,
  env: Environment,
): Promise<void> {
  const origin = mutationOrigin(request, env)
  const token = request.headers.get('x-csrf-token')
  if (!(token !== null && token !== '') || token.length > 2048) {
    throw new Problem(403, 'CSRF_INVALID')
  }
  try {
    const { payload } = await jwtVerify(token, secret(env), {
      algorithms: ['HS256'],
      issuer: 'blog-cms:csrf',
      audience: 'blog-cms:mutation',
      subject: sub,
      requiredClaims: ['exp', 'iat'],
    })
    if (payload.origin !== origin) {
      throw new Error('Invalid authentication configuration or claims')
    }
  }
  catch (error) {
    if (error instanceof Problem) {
      throw error
    }
    throw new Problem(403, 'CSRF_INVALID')
  }
}

function mutationOrigin(request: Request, env: Environment): string {
  const origin = request.headers.get('origin')
  const url = new URL(request.url)
  trustedOrigin(env)
  if (!(origin !== null && origin !== '') || origin !== url.origin) {
    throw new Problem(403, 'ORIGIN_INVALID')
  }
  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite !== null && fetchSite !== '' && fetchSite !== 'same-origin') {
    throw new Problem(403, 'ORIGIN_INVALID')
  }
  return origin
}
