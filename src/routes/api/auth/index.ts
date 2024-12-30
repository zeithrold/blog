import { OpenAPIHono } from '@hono/zod-openapi'
import * as F from 'fp-ts/function'
import callback from './callback'
import github from './github'
import signOut from './sign-out'
import whoami from './whoami'

const auth = new OpenAPIHono()

const _route = F.pipe(
  auth,
  callback,
  github,
  signOut,
  whoami,
)

export type ClientType = typeof _route

export default auth
