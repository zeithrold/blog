import { swaggerUI } from '@hono/swagger-ui'
import { OpenAPIHono } from '@hono/zod-openapi'
import meta from './meta'

const api = new OpenAPIHono()

api.route('/meta', meta)

api.doc('/doc', {
  openapi: '3.0.0',
  info: {
    title: 'Zeithrold\'s Blog API Documentation.',
    version: '1.0.0',

  },
  tags: [
    {
      name: 'Meta',
      description: 'Meta information about the API.',
    },
  ],
  servers: [
    {
      url: '/v1/api',
    },
  ],
})

api.get('/ui', swaggerUI({
  url: '/v1/api/doc',
}))

export default api
