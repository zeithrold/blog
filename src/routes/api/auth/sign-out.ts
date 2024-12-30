import type { OpenAPIHono } from '@hono/zod-openapi'
import { createRoute } from '@hono/zod-openapi'

const signOutRoute = createRoute({
  method: 'get',
  path: '/sign-out',
  tags: ['Auth'],
  security: [{ Session: [] }],
  responses: {
    302: {
      headers: {
        Location: {
          type: 'string',
        },
      },
      description: 'Redirects to the next URL.',
    },
  },
})

export default function signOut(hono: OpenAPIHono) {
  return hono.openapi(signOutRoute, async (c) => {
    const supabase = c.get('supabase')
    await supabase.auth.signOut()
    return c.redirect('/')
  })
}
