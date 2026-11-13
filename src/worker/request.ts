import type { Environment } from '@/server/runtime/environment'
import type { SecurityContext } from '@/worker/security'
import { Problem } from '@/server/http/problem'
import { publicOrigin } from '@/server/runtime/origin'

export function requestContext(
  request: Request,
  env: Environment,
  nonce: string,
): {
  url: URL
  request: Request
  security: SecurityContext
} {
  const url = new URL(request.url)
  if (url.origin !== publicOrigin(env)) {
    throw new Problem(403, 'HOST_INVALID')
  }
  validatePath(url.pathname)
  const headers = new Headers(request.headers)
  headers.set('x-blog-nonce', nonce)
  headers.set('x-blog-request-origin', url.origin)
  headers.set('Content-Security-Policy', `script-src 'self' 'nonce-${nonce}'`)
  return {
    url,
    request: new Request(request, { headers }),
    security: { nonce, head: request.method === 'HEAD' },
  }
}

function validatePath(path: string): void {
  if (/%|\\|\/\//.test(path) || (path !== '/' && path.endsWith('/'))) {
    throw new Problem(400, 'INVALID_PATH')
  }
}
