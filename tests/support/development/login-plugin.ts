import type { WorkerConfig } from '@cloudflare/vite-plugin'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Alias, Plugin } from 'vite'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { exportJWK, generateKeyPair, jwtVerify, SignJWT } from 'jose'

const issuer = 'https://blog-dev.cloudflareaccess.com'
const audience = 'blog-dev-audience'
const subject = 'blog-dev-owner'
const cookieName = 'blog_dev_access'

type DevelopmentLogin = {
  aliases: Alias[]
  plugin: Plugin
  config: (config: WorkerConfig) => Partial<WorkerConfig>
}

export async function developmentLogin(): Promise<DevelopmentLogin> {
  const { privateKey, publicKey } = await generateKeyPair('RS256')
  const jwk = { ...(await exportJWK(publicKey)), kid: 'blog-dev-key', alg: 'RS256', use: 'sig' }
  let origin = 'http://127.0.0.1:8800'
  const aliases = Object.fromEntries(['access-keyset', 'security'].map(name => [
    name === 'security' ? '@/worker/security' : '@/server/auth/access-keyset',
    fileURLToPath(new URL(`./${name}.ts`, import.meta.url)),
  ]))
  const vars = {
    ACCESS_TEAM_DOMAIN: 'blog-dev.cloudflareaccess.com',
    ACCESS_AUD: audience,
    CSRF_SIGNING_SECRET: randomBytes(32).toString('hex'),
    BLOG_DEV_ACCESS_JWK: JSON.stringify(jwk),
  }
  const handle = requestHandler(privateKey, publicKey, () => origin)
  const plugin: Plugin = {
    name: 'blog-development-login',
    apply: 'serve',
    enforce: 'pre',
    config(config) {
      if (config.server?.host !== '127.0.0.1') {
        throw new Error('Development test login requires --host 127.0.0.1')
      }
      origin = `http://127.0.0.1:${config.server.port ?? 8800}`
      return { server: { strictPort: true } }
    },
    configureServer(server) {
      server.middlewares.use((incoming, outgoing, next) => {
        handle(incoming, outgoing).then((handled) => {
          if (!handled) {
            next()
          }
        }).catch(next)
      })
    },
  }
  return {
    aliases: Object.entries(aliases).map(([find, replacement]) => ({ find, replacement })),
    plugin,
    config: (config: WorkerConfig): Partial<WorkerConfig> => ({
      vars: { ...config.vars, ...vars, PUBLIC_ORIGIN: origin },
      assets: {
        ...config.assets,
        run_worker_first: [
          '/*',
          '!/@vite/*',
          '!/@id/*',
          '!/@fs/*',
          '!/@react-refresh',
          '!/src/*',
          '!/node_modules/*',
        ],
      },
    }),
  }
}

async function loginResponse(incoming: IncomingMessage, outgoing: ServerResponse, privateKey: CryptoKey) {
  if (incoming.method !== 'GET' || incoming.headers['sec-fetch-site'] === 'cross-site') {
    outgoing.writeHead(403)
    outgoing.end('Invalid development login request')
    return
  }
  const login = incoming.url === '/__fixture/login'
  const token = login
    ? await new SignJWT({ type: 'app' })
        .setProtectedHeader({ alg: 'RS256', kid: 'blog-dev-key' })
        .setIssuer(issuer)
        .setAudience(audience)
        .setSubject(subject)
        .setIssuedAt()
        .setExpirationTime('8h')
        .sign(privateKey)
    : ''
  outgoing.writeHead(302, {
    'location': login ? '/admin' : '/',
    'cache-control': 'no-store',
    'set-cookie': `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${login ? 28800 : 0}`,
  })
  outgoing.end()
}

function requestHandler(privateKey: CryptoKey, publicKey: CryptoKey, getOrigin: () => string) {
  return async (incoming: IncomingMessage, outgoing: ServerResponse) => {
    delete incoming.headers['cf-access-jwt-assertion']
    // Cloudflare's Node → Request adapter reads rawHeaders, so update both representations.
    incoming.rawHeaders = incoming.rawHeaders.filter((value, index, headers) =>
      (index % 2 === 0 ? value : headers[index - 1])?.toLowerCase() !== 'cf-access-jwt-assertion')
    if (incoming.headers.host !== new URL(getOrigin()).host) {
      outgoing.writeHead(403)
      outgoing.end('Development test login requires the loopback origin')
      return true
    }
    if (incoming.url === '/__fixture/login' || incoming.url === '/__fixture/logout') {
      await loginResponse(incoming, outgoing, privateKey)
      return true
    }
    const prefix = `${cookieName}=`
    const cookies = (incoming.headers.cookie ?? '').split(';').map(value => value.trim())
    const cookie = cookies.find(value => value.startsWith(prefix))
    const token = cookie?.slice(cookieName.length + 1)
    if (token !== undefined) {
      try {
        await jwtVerify(token, publicKey, { algorithms: ['RS256'], issuer, audience, subject })
        incoming.headers['cf-access-jwt-assertion'] = token
        incoming.rawHeaders.push('cf-access-jwt-assertion', token)
      }
      catch {
        // Invalid or expired cookies proceed unauthenticated through the normal Worker guards.
      }
    }
    return false
  }
}
