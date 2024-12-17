import type { Context } from 'hono'
import { stream } from 'hono/streaming'
import { renderPage } from 'vike/server'

export default async function vike(c: Context) {
  const pageContext = await renderPage({
    urlOriginal: c.req.url,
    headersOriginal: c.req.header(),
  })
  const response = pageContext.httpResponse
  const { writable, readable } = new TransformStream()
  response.pipe(writable)
  c.status(response.statusCode)
  response.headers.forEach(([key, value]) => {
    c.header(key, value)
  })
  return stream(c, async (stream) => {
    await stream.pipe(readable)
  })
}
