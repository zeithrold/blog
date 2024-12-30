import { swaggerUI } from '@hono/swagger-ui'
import { OpenAPIHono } from '@hono/zod-openapi'
import auth from './auth'
import meta from './meta'

const api = new OpenAPIHono()

api.route('/meta', meta)
api.route('/auth', auth)

api.openAPIRegistry.registerComponent('securitySchemes', 'Session', {
  in: 'cookie',
  type: 'apiKey',
})

api.doc('/openapi.json', {
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
    {
      name: 'Auth',
      description: 'Authentication routes.',
    },
  ],
  servers: [
    {
      url: '/v1/api',
    },
  ],
})

api.get('/ui', swaggerUI({
  url: '/v1/api/openapi.json',
}))

export default api
