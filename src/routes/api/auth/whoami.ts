import type { OpenAPIHono } from '@hono/zod-openapi'
import get from '@/lib/sql/user/get'
import { createRoute, z } from '@hono/zod-openapi'

async function sha256(str: string) {
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

const WhoamiSuccessResponseSchema
  = z.object({
    data: z.object({
      openid: z.string().uuid(),
      email: z.string().email(),
      name: z.string(),
      avatar: z.string().url(),
    }).optional(),
    error: z.null(),
  })

const WhoamiErrorResponseSchema
  = z.object({
    data: z.null(),
    error: z.object({
      type: z.string(),
      message: z.string(),
    }),
  })

const whoamiRoute = createRoute({
  method: 'get',
  description: 'Get the current user.',
  path: '/whoami',
  security: [{ Session: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: WhoamiSuccessResponseSchema,
        },
      },
      description: 'The current user.',
    },
    401: {
      content: {
        'application/json': {
          schema: WhoamiErrorResponseSchema,
        },
      },
      description: 'Unauthorized.',
    },
    500: {
      content: {
        'application/json': {
          schema: WhoamiErrorResponseSchema,
        },
      },
      description: 'Internal error.',
    },
  },
})

export default function whoami(hono: OpenAPIHono) {
  return hono.openapi(whoamiRoute, async (c) => {
    const supabase = c.get('supabase')
    const { data, error } = await supabase.auth.getUser()
    if (error) {
      return c.json({
        data: null,
        error: {
          type: 'internal',
          message: 'Internal error.',
        },
      }, 500)
    }
    const { user } = data
    const dbUser = await get(user.id)()
    if (!dbUser) {
      return c.json({
        data: null,
        error: {
          type: 'unauthorized',
          message: 'User not found.',
        },
      }, 401)
    }
    const { name, email } = dbUser
    const avatar = `https://www.gravatar.com/avatar/${await sha256(email)}`
    return c.json({
      error: null,
      data: {
        name,
        email,
        openid: user.id,
        avatar,
      },
    }, 200)
  })
}
