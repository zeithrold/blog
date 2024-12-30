import supabase from '@/middlewares/supabase'
import vike from '@/middlewares/vike'
import api from '@/routes/api'
import { Hono } from 'hono'

import 'dotenv/config'

const app = new Hono()

app.use(async (c, next) => {
  c.header('Server', 'Zeithrold-Atami/1.0')
  await next()
})

app.use(supabase)
app.route('/v1/api', api)

app.all('*', vike)

export default app
