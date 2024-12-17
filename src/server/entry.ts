import vike from '@/middlewares/vike'

import { Hono } from 'hono'

const app = new Hono()

app.all('*', vike)

export default app
