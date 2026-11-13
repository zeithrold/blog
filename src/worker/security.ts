export type SecurityContext = {
  readonly nonce: string
  readonly head: boolean
}

export function security(
  response: Response,
  context: SecurityContext,
  policy?: string,
): Response {
  const headers = new Headers(response.headers)
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  const directives = [
    'default-src \'self\'',
    `script-src 'self' 'nonce-${context.nonce}'`,
    `style-src 'self' 'nonce-${context.nonce}' https://fonts.googleapis.com`,
    'style-src-attr \'unsafe-inline\'',
    'font-src \'self\' https://fonts.gstatic.com',
    'img-src \'self\' data: https:',
    'media-src \'self\' https:',
    'connect-src \'self\'',
    'worker-src \'self\'',
    'frame-src https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com',
    'object-src \'none\'',
    'base-uri \'none\'',
    'frame-ancestors \'none\'',
    'form-action \'self\'',
  ]
  headers.set('Content-Security-Policy', policy ?? directives.join('; '))
  headers.set('Cache-Control', 'no-store')
  if (context.head) {
    response.body?.cancel().catch(() => undefined)
  }
  return new Response(context.head ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
