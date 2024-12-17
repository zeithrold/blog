import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import production from './production'

const app = new Hono()

app.use('/assets/*', serveStatic({
  root: './dist/client',
}))

app.route('/', production)

app.onError((error, c) => {
  console.error(error)
  return c.json({ error: error.message }, 500)
})

// eslint-disable-next-line no-console
console.log('Server running on http://localhost:3000')
serve({
  fetch: app.fetch,
  port: 3000,
})
