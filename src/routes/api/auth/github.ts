import type { Context } from 'hono'

/**
 * GitHub OAuth login route. This route redirects the user to the GitHub OAuth login page.
 * @param c Context instance.
 * @returns Response instance.
 */
export default async function github(c: Context) {
  const currentUrl = new URL(c.req.url)
  currentUrl.pathname = '/api/auth/callback'
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
}
