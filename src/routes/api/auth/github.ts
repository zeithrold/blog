import type { OpenAPIHono } from '@hono/zod-openapi'
import {
  Response as R,
} from '@/lib/openapi'
import { createRoute } from '@hono/zod-openapi'

const githubRoute = createRoute({
  method: 'get',
  path: '/github',
  description: 'Login with GitHub',
  tags: ['Auth'],
  responses: {
    ...R.redirect({
      description: 'Redirects to the GitHub OAuth login page.',
    }),
  },
})

/**
 * GitHub OAuth login route. This route redirects the user to the GitHub OAuth login page.
 * @param hono OpenAPIHono instance.
 * @returns Routing instance, can be continously chained.
 */
export default function github(hono: OpenAPIHono) {
  return hono.openapi(githubRoute, async (c) => {
    // Get the current URL and set the callback URL to the OAuth callback route.
    const currentUrl = new URL(c.req.url)
    currentUrl.pathname = '/v1/api/auth/callback'
    const supabase = c.get('supabase')
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: currentUrl.toString(),
      },
    })
    if (error) {
      return c.redirect('/user/login?error=internal')
    }
    const { url } = data
    return c.redirect(url)
  })
}
