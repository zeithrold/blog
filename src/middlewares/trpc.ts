import type { ContextVariableMap } from 'hono'
import { initTRPC } from '@trpc/server'

export interface Context extends ContextVariableMap {}

const t = initTRPC.context<Context>().create()

export const { procedure, router } = t
