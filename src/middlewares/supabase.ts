import { createSupabase } from '@/lib/supabase/init'
import { createMiddleware } from 'hono/factory'

const supabase = createMiddleware(async (c, next) => {
  const supabase = createSupabase(c)
  const { data: { user } } = await supabase.auth.getUser()
  c.set('supabase', supabase)
  c.set('user', user)
  await next()
})

export default supabase
