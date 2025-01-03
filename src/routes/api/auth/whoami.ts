import type { OpenAPIHono } from '@hono/zod-openapi'
import { handle } from '@/lib/helper/handler'
import { Response as R } from '@/lib/openapi'
import { returnUser } from '@/task/postprocess/api/auth-whoami'
import { prepareOpenID } from '@/task/preprocess/api/auth-whoami'
import { getUser } from '@/task/process/get-user'
import { createRoute, z } from '@hono/zod-openapi'
import * as F from 'fp-ts/function'
import * as TE from 'fp-ts/TaskEither'

const WhoamiResponseSchema
  = z.object({
    data: z.object({
      openid: z.string().uuid().openapi({ description: 'The user ID.' }),
      email: z.string().email().openapi({ description: 'The user email.' }),
      name: z.string().openapi({ description: 'The user name.' }),
      avatar: z.string().url().openapi({ description: 'The user avatar.' }),
    })
      .nullable()
      .openapi({
        description: 'The current user. If the user is not registered, this field will be null.',
      }),
    error: z.null(),
  }).openapi('WhoamiResponse')

const whoamiRoute = createRoute({
  method: 'get',
  description: 'Get the current user.',
  path: '/whoami',
  security: [{ Session: [] }],
  responses: {
    ...R.json({
      schema: WhoamiResponseSchema,
      description: 'The current user.',
    }),
    ...R.error({
      status: 401,
      description: 'Will return a 401 if the user is not authorized.',
    }),
  },
})

export default function whoami(hono: OpenAPIHono) {
  return hono.openapi(whoamiRoute, async (c) => {
    const backend = F.flow(
      prepareOpenID,
      TE.chain(getUser),
      TE.chain(returnUser),
    )
    const { body, status } = await handle(backend(c))
    return c.json(body, status)
  })
}
