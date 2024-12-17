import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import production from './production'

const app = new Hono()
app.route('/', production)

const handler = handle(production)

export {
  handler as DELETE,
  handler as GET,
  handler as OPTIONS,
  handler as PATCH,
  handler as POST,
  handler as PUT,
}
