import type { SecurityContext } from '~/src/worker/security'
import { privatePath, security as workerSecurity } from '~/src/worker/security'

// Use the root alias to reach the real module; @/worker/security selects this replacement in development.
export { privatePath }

export function security(response: Response, context: SecurityContext, policy?: string): Response {
  const result = workerSecurity(response, context, policy)
  // Vite's refresh preamble and injected style sheets need inline execution in development.
  if (policy === undefined) {
    const csp = result.headers.get('Content-Security-Policy')
    if (csp === null) {
      throw new Error('Missing Worker content security policy')
    }
    result.headers.set('Content-Security-Policy', csp
      .replace(/script-src [^;]+/, 'script-src \'self\' \'unsafe-inline\' \'unsafe-eval\'')
      .replace(/style-src [^;]+/, 'style-src \'self\' \'unsafe-inline\' https://fonts.googleapis.com')
      .replace(/connect-src [^;]+/, 'connect-src \'self\' ws://127.0.0.1:*'))
  }
  return result
}
