import type { Environment } from '@/server/environment'
import { AssetGC } from '@/server/asset-gc'
import { Problem, problemResponse } from '@/server/problem'
import { ScheduleRepository } from '@/server/schedules'
import { dispatch } from '@/worker/dispatch'
import { requestContext } from '@/worker/request'
import { security } from '@/worker/security'

export { privatePath } from '@/worker/security'
export default {
  async scheduled(_event: unknown, env: Environment): Promise<void> {
    await new ScheduleRepository(env.DB).runDue()
    await new AssetGC(env.DB).collect(env.MEDIA)
  },
  async fetch(request: Request, env: Environment): Promise<Response> {
    const nonce = crypto.randomUUID().replaceAll('-', '')
    try {
      const context = await requestContext(request, env, nonce)
      const result = await dispatch(context.request, env)
      return security(result.response, context.security, result.policy)
    }
    catch (error) {
      if (
        !(error instanceof Problem)
        && error instanceof Error
        && error.name !== 'ContentError'
      ) {
        console.error('CMS_UNEXPECTED_ERROR', error.name)
      }
      return security(problemResponse(error), {
        nonce,
        privateResponse: true,
        head: request.method === 'HEAD',
      })
    }
  },
}
