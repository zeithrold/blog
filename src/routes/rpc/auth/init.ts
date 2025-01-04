import { initUser } from '@/lib/data'
import { procedure as P } from '@/middlewares/trpc'
import { TRPCError } from '@trpc/server'
import * as E from 'fp-ts/Either'
import { z } from 'zod'

export default P
  .input(z.object({
    name: z.string(),
    introduction: z.string().optional(),
  }))
  .output(z.object({
    success: z.boolean(),
  }))
  .mutation(async (opts) => {
    const { user } = opts.ctx
    if (!user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
      })
    }
    if (user.email === undefined || user.email === '') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Your user profile does not have an email address. Please update your profile and try again.',
      })
    }
    const { name, introduction } = opts.input
    const insertResult = await initUser({
      name,
      introduction,
      openid: user.id,
      email: user.email,
    })()
    if (E.isLeft(insertResult)) {
      throw insertResult.left
    }
    return {
      success: true,
    }
  })
