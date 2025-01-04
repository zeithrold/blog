import type { Context } from 'hono'

/**
 * Callback route for OAuth providers. This route is used to exchange the code for a session.
 *
 * @param c Context instance.
 * @returns Response instance.
 */
export default async function callback(c: Context) {
  const code = c.req.query('code')
  if (code === undefined || code === '') {
    return c.redirect('/user/login?error=invalid_params')
  }
  const next = c.req.query('next') ?? '/'
  const supabase = c.get('supabase')
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return c.redirect('/user/login?error=invalid_code')
  }
  return c.redirect(next)
}
