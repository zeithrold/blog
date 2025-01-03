import type { OpenAPIHono } from '@hono/zod-openapi'
import {
  Response as R,
} from '@/lib/openapi'
import { createRoute } from '@hono/zod-openapi'

const signOutRoute = createRoute({
  method: 'get',
  path: '/sign-out',
  tags: ['Auth'],
  security: [{ Session: [] }],
  responses: {
    ...R.redirect({
      description: 'Redirects to the home page.',
    }),
  },
  description: 'Sign out of the current session.',
})

export default function signOut(hono: OpenAPIHono) {
  return hono.openapi(signOutRoute, async (c) => {
    const supabase = c.get('supabase')
    const { error } = await supabase.auth.signOut()
    if (error) {
      return c.redirect('/?sign-out-error=internal')
    }
    return c.redirect('/')
  })
}
