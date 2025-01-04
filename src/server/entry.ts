import supabase from '@/middlewares/supabase'
import vike from '@/middlewares/vike'
import api from '@/routes/api'
import { appRouter } from '@/routes/rpc'
import { trpcServer } from '@hono/trpc-server'
import { Hono } from 'hono'

import 'dotenv/config'

const app = new Hono()

app.use(supabase)

app.route('/api', api)
app.use('/rpc/*', trpcServer({
  router: appRouter,
  createContext: (_, c) => ({
    supabase: c.get('supabase'),
    user: c.get('user'),
  }),
}))

app.all('*', vike)

export default app
