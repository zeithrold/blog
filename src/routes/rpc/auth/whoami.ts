import { getUser } from '@/lib/data'
import { sha256 } from '@/lib/util'
import { procedure as P } from '@/middlewares/trpc'
import { TRPCError } from '@trpc/server'
import * as E from 'fp-ts/Either'
import { z } from 'zod'

async function getAvatar(email: string) {
  return `https://www.gravatar.com/avatar/${await sha256(email)}`
}

export default P
  .output(z.object({
    name: z.string(),
    email: z.string().email(),
    role: z.enum([
      'admin',
      'editor',
      'subscriber',
    ]),
    avatar: z.string().url(),
  }).nullable())
  .query(async (opts) => {
    const { user } = opts.ctx
    if (!user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
      })
    }
    const queryResult = await getUser(user.id)()
    if (E.isLeft(queryResult)) {
      throw queryResult.left
    }
    const dbUser = queryResult.right
    if (!dbUser) {
      return null
    }
    return {
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      avatar: await getAvatar(dbUser.email),
    }
  })
