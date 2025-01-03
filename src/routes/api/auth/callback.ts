import type { OpenAPIHono } from '@hono/zod-openapi'
import {
  Response as R,
  Security as S,
} from '@/lib/openapi'
import { createRoute, z } from '@hono/zod-openapi'

export const CallbackParamsSchema = z
  .object({
    code: z
      .string()
      .describe('The code from the OAuth provider.'),
    next: z
      .string()
      .optional()
      .describe('The URL to redirect to after the callback.'),
  })

const callbackRoute = createRoute({
  method: 'get',
  path: '/callback',
  tags: ['Auth'],
  operationId: 'auth-callback',
  request: {
    query: CallbackParamsSchema,
  },
  security: S.session(),
  responses: {
    ...R.redirect({
      description: 'Redirects to the next URL.',
    }),
  },
})

export default function callback(hono: OpenAPIHono) {
  return hono.openapi(callbackRoute, async (c) => {
    const query = c.req.valid('query')
    const { code } = query
    const next = query.next ?? '/'
    const supabase = c.get('supabase')
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return c.redirect('/user/login?error=invalid_code')
    }
    return c.redirect(next)
  })
}
