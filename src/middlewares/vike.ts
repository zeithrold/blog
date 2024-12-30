import type { Context } from 'hono'
import { stream } from 'hono/streaming'
import { minify } from 'html-minifier-terser'
import { renderPage } from 'vike/server'

export default async function vike(c: Context) {
  const supabase = c.get('supabase')
  const user = c.get('user')
  const method = c.req.method
  const pageContext = await renderPage({
    urlOriginal: c.req.url,
    headersOriginal: c.req.header(),
    supabase,
    user,
    method,
  })
  const response = pageContext.httpResponse
  let htmlBody: string
  try {
    // eslint-disable-next-line ts/no-unsafe-assignment, ts/no-unsafe-call
    htmlBody = await minify(response.body, {
      collapseWhitespace: true,
      minifyJS: true,
      removeComments: true,
    })
  }
  catch (error) {
    console.error('Error during HTML minification:', error)
    htmlBody = response.body
  }
  c.status(response.statusCode)
  response.headers.forEach(([key, value]) => {
    c.header(key, value)
  })
  return c.body(htmlBody)
  // return stream(c, async (stream) => {
  //   await stream.pipe(readable)
  // })
}
