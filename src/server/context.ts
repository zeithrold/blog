import { env } from 'cloudflare:workers'
import { headers } from 'next/headers'
import { requireOwner, sessionToken, trustedOrigin } from '@/server/auth'
import { Problem } from '@/server/problem'
import { PublicRepository } from '@/server/public-repository'

export function repository(): PublicRepository {
  return new PublicRepository(env.DB)
}
export async function serverOwner(): Promise<string> {
  return await requireOwner(new Headers(await headers()), env)
}
export async function serverSessionToken(owner: string): Promise<string> {
  const requestOrigin = (await headers()).get('x-blog-request-origin')
  const origin = trustedOrigin(env)
  if (requestOrigin === origin.origin) {
    return await sessionToken(owner, origin.origin, env)
  }
  if (requestOrigin !== null) {
    const preview = new URL(requestOrigin)
    if (
      preview.protocol === 'https:'
      && (env.ALLOWED_PREVIEW_HOSTS ?? '').split(',').includes(preview.host)
    ) {
      return await sessionToken(owner, preview.origin, env)
    }
  }
  throw new Problem(403, 'HOST_INVALID')
}
