import type { Context } from 'hono'

export default async function signOut(c: Context) {
  const supabase = c.get('supabase')
  const { error } = await supabase.auth.signOut()
  if (error) {
    return c.redirect('/?sign-out-error=internal')
  }
  return c.redirect('/')
}
