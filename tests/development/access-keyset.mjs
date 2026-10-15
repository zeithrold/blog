import { env } from 'cloudflare:workers'
import { createLocalJWKSet } from 'jose'

// Vite aliases this module only during serve; production uses remote Access certificates.
export function ownerKeyset(issuer) {
  if (issuer !== 'https://blog-dev.cloudflareaccess.com') {
    throw new Error('Unexpected development Access issuer')
  }
  return createLocalJWKSet({ keys: [
    JSON.parse(env.BLOG_DEV_ACCESS_JWK),
  ] })
}
