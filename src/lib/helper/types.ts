import type { TRPCError } from '@trpc/server'
import type * as TE from 'fp-ts/TaskEither'

/**
 * `AsyncReturnType` is for getting the return type of an async function.
 */
export type AsyncReturnType<T extends (...args: any[]) => any> = Awaited<ReturnType<T>>

/**
 * `TaskProduct` is for getting the return type of a task function.
 */
export type TaskProduct<
  T extends (...args: any[]) => (() => Promise<any>),
> = Awaited<ReturnType<ReturnType<T>>>

export type TaskEitherError<T> = TE.TaskEither<TRPCError, T>
