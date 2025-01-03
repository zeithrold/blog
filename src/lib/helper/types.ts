import type * as TE from 'fp-ts/TaskEither'
import type { Error } from '../error'

/**
 * `TaskProduct` is for getting the return type of a task function.
 */
export type TaskProduct<
  T extends (...args: any[]) => (() => Promise<any>),
> = Awaited<ReturnType<ReturnType<T>>>

export type TaskEitherError<T> = TE.TaskEither<Error, T>

export interface ErrorResponse {
  id: string
  description: string
}
