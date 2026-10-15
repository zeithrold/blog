import { privatePath, security as workerSecurity } from '../../src/worker/security.ts'

export { privatePath }

export function security(response, context, policy) {
  const result = workerSecurity(response, context, policy)
  // Vite's refresh preamble and injected style sheets need inline execution in development.
  if (policy === undefined) {
    result.headers.set('Content-Security-Policy', result.headers.get('Content-Security-Policy')
      .replace(/script-src [^;]+/, 'script-src \'self\' \'unsafe-inline\' \'unsafe-eval\'')
      .replace(/style-src [^;]+/, 'style-src \'self\' \'unsafe-inline\' https://fonts.googleapis.com')
      .replace(/connect-src [^;]+/, 'connect-src \'self\' ws://127.0.0.1:*'))
  }
  return result
}
