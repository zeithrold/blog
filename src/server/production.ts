import { Hono } from 'hono'
import { compress } from 'hono/compress'
import { etag } from 'hono/etag'
import entry from './entry'

const app = new Hono()

app.use(compress())
app.use(etag())
app.route('/', entry)

export default app
