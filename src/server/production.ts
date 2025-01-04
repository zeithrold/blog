import { Hono } from 'hono'
import { etag } from 'hono/etag'
import entry from './entry'

const app = new Hono()

app.use(etag())
app.route('/', entry)

export default app
