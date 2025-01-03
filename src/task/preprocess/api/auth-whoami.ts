import type { TaskEitherError } from '@/lib/helper/types'
import type { Context } from 'hono'
import { User } from '@/lib/error/handlers'
import * as E from 'fp-ts/Either'

export function prepareOpenID(c: Context): TaskEitherError<string> {
  return async () => {
    const user = c.get('user')
    if (user == null) {
      return E.left(User.notLoggedIn())
    }
    return E.right(user.id)
  }
}
