import type { TaskEitherError } from '@/lib/helper/types'
import type { GetUserResult } from '@/task/process/get-user'
import * as User from '@/lib/error/handlers/user'
import { sha256 } from '@/lib/util'
import * as E from 'fp-ts/Either'
import { z } from 'zod'

export const ReturnUserResultSchema = z.object({
  openid: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(['admin', 'editor', 'subscriber']),
  avatar: z.string(),
})

export type ReturnUserResult = z.infer<typeof ReturnUserResultSchema>

export function returnUser(user: GetUserResult): TaskEitherError<ReturnUserResult> {
  return async () => {
    if (!user) {
      return E.left(User.unregistered())
    }
    return E.right({
      openid: user.supabase,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: `https://www.gravatar.com/avatar/${await sha256(user.email)}`,
    })
  }
}
