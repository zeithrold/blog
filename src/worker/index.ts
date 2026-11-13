import type { Environment } from '@/server/runtime/environment'
import { Problem, problemResponse } from '@/server/http/problem'
import { dispatch } from '@/worker/dispatch'
import { requestContext } from '@/worker/request'
import { security } from '@/worker/security'

export default {
  async fetch(request: Request, env: Environment): Promise<Response> {
    const nonce = crypto.randomUUID().replaceAll('-', '')
    try {
      const context = requestContext(request, env, nonce)
      const result = await dispatch(context.request, env)
      return security(result.response, context.security)
    }
    catch (error) {
      if (
        !(error instanceof Problem)
        && error instanceof Error
      ) {
        console.error('BLOG_UNEXPECTED_ERROR', error.name)
      }
      return security(problemResponse(error), {
        nonce,
        head: request.method === 'HEAD',
      })
    }
  },
}
