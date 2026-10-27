import { env } from 'cloudflare:workers'
import { createLocalJWKSet } from 'jose'
import { z } from 'zod'

// Vite aliases this module only during serve; production uses remote Access certificates.
export function accessKeyset(issuer: string): ReturnType<typeof createLocalJWKSet> {
  if (issuer !== 'https://blog-dev.cloudflareaccess.com') {
    throw new Error('Unexpected development Access issuer')
  }
  return createLocalJWKSet({ keys: [
    z.looseObject({ kty: z.string() }).parse(JSON.parse(developmentJwk())),
  ] })
}

function developmentJwk(): string {
  if (!('BLOG_DEV_ACCESS_JWK' in env) || typeof env.BLOG_DEV_ACCESS_JWK !== 'string') {
    throw new Error('Missing development Access key')
  }
  return env.BLOG_DEV_ACCESS_JWK
}
