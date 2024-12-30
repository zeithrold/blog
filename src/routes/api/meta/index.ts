import { OpenAPIHono } from '@hono/zod-openapi'
import version from './version'

const meta = new OpenAPIHono()

version(meta)

export default meta
