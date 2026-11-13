import type { Environment } from './environment'
import { Problem } from '@/server/http/problem'

export function publicOrigin(env: Pick<Environment, 'PUBLIC_ORIGIN'>): string {
  const url = URL.parse(env.PUBLIC_ORIGIN)
  if (
    url === null
    || url.origin !== env.PUBLIC_ORIGIN
    || (url.protocol !== 'https:'
      && !(url.protocol === 'http:' && [
        '127.0.0.1',
        'localhost',
        '[::1]',
      ].includes(url.hostname)))
  ) {
    throw new Problem(503, 'ORIGIN_INVALID')
  }
  return url.origin
}
