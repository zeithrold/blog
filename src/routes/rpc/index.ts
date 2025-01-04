import { router as R } from '@/middlewares/trpc'
import auth from './auth'
import meta from './meta'

export const appRouter = R({
  meta,
  auth,
})

export type AppRouter = typeof appRouter
