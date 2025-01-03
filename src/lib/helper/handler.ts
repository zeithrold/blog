import type { TaskEitherError } from './types'
import * as E from 'fp-ts/Either'

export interface HandleResult<T> {
  body: {
    error: {
      id: string
      description: string
    }
    data: null
  } | {
    error: null
    data: T
  }
  status: number
}

export function internal(status: number) {
  return {
    body: {
      error: {
        id: 'internal_error',
        description: 'An internal error occurred.',
      },
      data: null,
    },
    status,
  }
}

export async function handle<T>(task: TaskEitherError<T>): Promise<HandleResult<T>> {
  const eitherResult = await task()
  if (E.isLeft(eitherResult)) {
    const result = eitherResult.left
    if (result.internal) {
      return internal(result.status)
    }
    else {
      return {
        body: {
          error: {
            id: result.id,
            description: result.description,
          },
          data: null,
        },
        status: result.status,
      }
    }
  }
  else {
    return {
      body: {
        error: null,
        data: eitherResult.right,
      },
      status: 200,
    }
  }
}
