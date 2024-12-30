import type { OpenAPIHono } from '@hono/zod-openapi'
import packageJson from '@/../package.json'
import { createRoute, z } from '@hono/zod-openapi'

export const VersionSchema = z
  .object({
    version: z
      .string()
      .describe('The version of the backend.'),
  })
  .openapi('Version', {
    description: 'The version of the backend.',
    deprecated: true,
  })

const versionRoute = createRoute({
  method: 'get',
  path: '/version',
  tags: ['Meta'],
  security: [{ Session: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: VersionSchema,
        },
      },
      description: 'Returns the version of the backend.',
    },
  },
})

export default function version(hono: OpenAPIHono) {
  hono.openapi(versionRoute, (c) => {
    return c.json({
      version: packageJson.version,
    })
  })
}
