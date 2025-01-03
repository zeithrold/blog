import type * as T from 'fp-ts/Task'
import * as TE from 'fp-ts/TaskEither'
import Handlers from './handlers'
import unknown from './handlers/unknown'

interface Error_ {
  id: string
  description: string
  status: number
  internal?: boolean
  stack?: Error | unknown
}

export { Handlers }

/**
 * Wraps a task with an error handler,
 * usually used for handling runtime errors in tasks like SQL errors.
 * @param task The task to wrap.
 * @param errorHandler The error handler, can be multiple.
 * @returns The task either.
 */
export function wrapper<R>(
  task: T.Task<R>,
  ...errorHandler: ((error: unknown) => Error_ | undefined)[]
): TE.TaskEither<Error_, R> {
  return TE.tryCatch(
    async () => task(),
    (error) => {
      for (const handler of errorHandler) {
        const result = handler(error)
        if (result) {
          return result
        }
      }
      return unknown(error)
    },
  )
}

export type {
  Error_ as Error,
}
